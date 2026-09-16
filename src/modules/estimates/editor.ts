import type { CostType, PriceType, ProposalStatus, VatMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/permissions";
import { requireAuthContext } from "@/modules/organizations/access";
import { getEstimateWorkspace } from "@/modules/estimates/draft";
import { bumpRevision, ConflictError } from "@/modules/estimates/versions";

export { ConflictError };

async function loadOwnedEstimate(userId: string, estimateId: string) {
  const ctx = await requireAuthContext(userId, "estimate:write");
  const estimate = await getEstimateWorkspace(userId, estimateId);
  return { ctx, estimate };
}

export async function updateEstimateMeta(opts: {
  userId: string;
  estimateId: string;
  expectedRevision: number;
  title?: string;
  terms?: string;
  exclusions?: string;
  offerValidUntil?: string | null;
  proposalStatus?: ProposalStatus;
}) {
  const { estimate } = await loadOwnedEstimate(opts.userId, opts.estimateId);
  if (estimate.draftRevision !== opts.expectedRevision) throw new ConflictError();

  await prisma.estimate.update({
    where: { id: estimate.id },
    data: {
      title: opts.title ?? undefined,
      terms: opts.terms ?? undefined,
      exclusions: opts.exclusions ?? undefined,
      offerValidUntil:
        opts.offerValidUntil === undefined
          ? undefined
          : opts.offerValidUntil
            ? new Date(opts.offerValidUntil)
            : null,
      proposalStatus: opts.proposalStatus,
    },
  });
  return bumpRevision(estimate.id, opts.expectedRevision);
}

export async function updateProjectMeta(opts: {
  userId: string;
  projectId: string;
  name?: string;
  objectName?: string;
  clientName?: string;
  description?: string;
  assumptions?: string;
  cityId?: string | null;
}) {
  const ctx = await requireAuthContext(opts.userId, "project:write");
  const project = await prisma.project.findUnique({ where: { id: opts.projectId } });
  if (!project || project.organizationId !== ctx.organizationId) {
    throw new NotFoundError("Project not found");
  }
  return prisma.project.update({
    where: { id: project.id },
    data: {
      name: opts.name,
      objectName: opts.objectName,
      clientName: opts.clientName,
      description: opts.description,
      assumptions: opts.assumptions,
      cityId: opts.cityId === undefined ? undefined : opts.cityId,
    },
  });
}

export async function addManualLine(opts: {
  userId: string;
  estimateId: string;
  expectedRevision: number;
  name: string;
  unit: string;
  qty: string;
  costType: CostType;
  unitSalePrice?: string | null;
  sectionId?: string;
}) {
  const { estimate } = await loadOwnedEstimate(opts.userId, opts.estimateId);
  if (estimate.draftRevision !== opts.expectedRevision) throw new ConflictError();

  const sectionId =
    opts.sectionId ??
    estimate.sections[0]?.id ??
    (
      await prisma.estimateSection.create({
        data: { estimateId: estimate.id, title: "Прочее", sortOrder: 99 },
      })
    ).id;

  const maxSort =
    estimate.lines.reduce((m, l) => Math.max(m, l.sortOrder), -1) + 1;

  const price = opts.unitSalePrice ?? null;
  await prisma.estimateLine.create({
    data: {
      estimateId: estimate.id,
      sectionId,
      sortOrder: maxSort,
      costType: opts.costType,
      nameSnapshot: opts.name,
      unitSnapshot: opts.unit,
      qty: opts.qty,
      unitSalePrice: price,
      saleVatMode: "zero",
      saleVatRate: "0",
      priceType: price ? "fixed" : "on_request",
      confirmationStatus: price ? "draft" : "pending_quote",
      unknownPriceReason: price ? null : "Ручная строка без цены",
      sourceLabel: "Ручной ввод",
      sourcedAt: new Date(),
    },
  });
  return bumpRevision(estimate.id, opts.expectedRevision);
}

export async function updateLineFields(opts: {
  userId: string;
  lineId: string;
  expectedRevision: number;
  qty?: string;
  unitSalePrice?: string | null;
  discountPercent?: string | null;
  offerId?: string | null;
  sortOrder?: number;
  sectionId?: string | null;
}) {
  const ctx = await requireAuthContext(opts.userId, "estimate:write");
  const line = await prisma.estimateLine.findUnique({
    where: { id: opts.lineId },
    include: { estimate: { include: { project: true } }, offer: true },
  });
  if (!line || line.estimate.project.organizationId !== ctx.organizationId) {
    throw new NotFoundError("Line not found");
  }
  if (line.estimate.draftRevision !== opts.expectedRevision) {
    throw new ConflictError();
  }

  let offerPatch: Record<string, unknown> = {};
  if (opts.offerId !== undefined) {
    if (opts.offerId == null) {
      offerPatch = {
        offerId: null,
        unitPurchasePrice: null,
        supplierOrganizationId: null,
        supplierNameSnapshot: null,
      };
    } else {
      const offer = await prisma.offer.findFirst({
        where: {
          id: opts.offerId,
          moderationStatus: "approved",
          ...(line.catalogItemId ? { catalogItemId: line.catalogItemId } : {}),
        },
        include: { supplier: true },
      });
      if (!offer) throw new NotFoundError("Offer not found");
      const fixed = offer.priceType === "fixed" && offer.price != null;
      offerPatch = {
        offerId: offer.id,
        unitPurchasePrice: fixed ? offer.price : null,
        purchaseVatMode: offer.inputVatMode,
        purchaseVatRate: offer.inputVatRate,
        unitSalePrice: fixed ? offer.price : opts.unitSalePrice ?? line.unitSalePrice,
        saleVatMode: offer.inputVatMode === "included" ? "excluded" : offer.inputVatMode,
        saleVatRate: offer.inputVatRate,
        priceType: offer.priceType as PriceType,
        supplierOrganizationId: offer.supplierOrganizationId,
        supplierNameSnapshot: offer.supplier.name,
        sourceLabel: `Offer ${offer.id.slice(0, 8)}`,
        sourcedAt: offer.updatedAt,
        unknownPriceReason: fixed ? null : offer.unknownPriceReason ?? "Цена не фиксирована",
        confirmationStatus: fixed ? "draft" : "pending_quote",
      };
    }
  }

  await prisma.estimateLine.update({
    where: { id: line.id },
    data: {
      qty: opts.qty,
      unitSalePrice:
        opts.unitSalePrice === undefined ? undefined : opts.unitSalePrice,
      discountPercent:
        opts.discountPercent === undefined ? undefined : opts.discountPercent,
      sortOrder: opts.sortOrder,
      sectionId: opts.sectionId === undefined ? undefined : opts.sectionId,
      ...offerPatch,
      unknownPriceReason:
        opts.unitSalePrice !== undefined
          ? opts.unitSalePrice
            ? null
            : "Цена не указана"
          : undefined,
    },
  });
  return bumpRevision(line.estimateId, opts.expectedRevision);
}

export async function duplicateSection(opts: {
  userId: string;
  sectionId: string;
  expectedRevision: number;
}) {
  const ctx = await requireAuthContext(opts.userId, "estimate:write");
  const section = await prisma.estimateSection.findUnique({
    where: { id: opts.sectionId },
    include: {
      estimate: { include: { project: true, sections: true, lines: true } },
    },
  });
  if (!section || section.estimate.project.organizationId !== ctx.organizationId) {
    throw new NotFoundError("Section not found");
  }
  if (section.estimate.draftRevision !== opts.expectedRevision) {
    throw new ConflictError();
  }

  const maxSectionSort =
    section.estimate.sections.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1;
  const newSection = await prisma.estimateSection.create({
    data: {
      estimateId: section.estimateId,
      title: `${section.title} (копия)`,
      sortOrder: maxSectionSort,
    },
  });

  const lines = section.estimate.lines.filter((l) => l.sectionId === section.id);
  let sort = section.estimate.lines.reduce((m, l) => Math.max(m, l.sortOrder), -1) + 1;
  for (const l of lines) {
    await prisma.estimateLine.create({
      data: {
        estimateId: section.estimateId,
        sectionId: newSection.id,
        catalogItemId: l.catalogItemId,
        offerId: l.offerId,
        sortOrder: sort++,
        costType: l.costType,
        nameSnapshot: l.nameSnapshot,
        unitSnapshot: l.unitSnapshot,
        qty: l.qty,
        purchaseQty: l.purchaseQty,
        unitPurchasePrice: l.unitPurchasePrice,
        purchaseVatMode: l.purchaseVatMode,
        purchaseVatRate: l.purchaseVatRate,
        unitSalePrice: l.unitSalePrice,
        saleVatMode: l.saleVatMode,
        saleVatRate: l.saleVatRate,
        priceType: l.priceType,
        confirmationStatus: l.confirmationStatus,
        discountPercent: l.discountPercent,
        discountAmount: l.discountAmount,
        supplierOrganizationId: l.supplierOrganizationId,
        supplierNameSnapshot: l.supplierNameSnapshot,
        sourceLabel: l.sourceLabel,
        sourcedAt: l.sourcedAt,
        unknownPriceReason: l.unknownPriceReason,
      },
    });
  }
  return bumpRevision(section.estimateId, opts.expectedRevision);
}

export async function addAdjustment(opts: {
  userId: string;
  estimateId: string;
  expectedRevision: number;
  name: string;
  type: "amount" | "percent";
  value: string;
  baseLineIds?: string[];
  costType?: CostType;
}) {
  const { estimate } = await loadOwnedEstimate(opts.userId, opts.estimateId);
  if (estimate.draftRevision !== opts.expectedRevision) throw new ConflictError();

  const applyOrder =
    estimate.adjustments.reduce((m, a) => Math.max(m, a.applyOrder), -1) + 1;

  await prisma.adjustment.create({
    data: {
      estimateId: estimate.id,
      name: opts.name,
      type: opts.type,
      value: opts.value,
      baseLineIds: opts.baseLineIds ?? estimate.lines.map((l) => l.id),
      vatMode: "zero" as VatMode,
      vatRate: "0",
      applyOrder,
      costType: opts.costType ?? "logistics",
    },
  });
  return bumpRevision(estimate.id, opts.expectedRevision);
}

export async function removeAdjustment(opts: {
  userId: string;
  adjustmentId: string;
  expectedRevision: number;
}) {
  const ctx = await requireAuthContext(opts.userId, "estimate:write");
  const adj = await prisma.adjustment.findUnique({
    where: { id: opts.adjustmentId },
    include: { estimate: { include: { project: true } } },
  });
  if (!adj || adj.estimate.project.organizationId !== ctx.organizationId) {
    throw new NotFoundError("Adjustment not found");
  }
  if (adj.estimate.draftRevision !== opts.expectedRevision) throw new ConflictError();
  await prisma.adjustment.delete({ where: { id: adj.id } });
  return bumpRevision(adj.estimateId, opts.expectedRevision);
}

export async function duplicateEstimate(opts: {
  userId: string;
  estimateId: string;
}) {
  const source = await getEstimateWorkspace(opts.userId, opts.estimateId);
  await requireAuthContext(opts.userId, "estimate:write");

  const count = await prisma.estimate.count({
    where: { projectId: source.projectId },
  });

  return prisma.$transaction(async (tx) => {
    const created = await tx.estimate.create({
      data: {
        projectId: source.projectId,
        number: `СМ-${String(count + 1).padStart(3, "0")}`,
        title: `${source.title} (копия)`,
        currency: source.currency,
        terms: source.terms,
        exclusions: source.exclusions,
        calculationPolicyVersion: source.calculationPolicyVersion,
      },
    });

    const sectionMap = new Map<string, string>();
    for (const s of source.sections) {
      const ns = await tx.estimateSection.create({
        data: {
          estimateId: created.id,
          title: s.title,
          sortOrder: s.sortOrder,
        },
      });
      sectionMap.set(s.id, ns.id);
    }

    const lineMap = new Map<string, string>();
    for (const l of source.lines) {
      const nl = await tx.estimateLine.create({
        data: {
          estimateId: created.id,
          sectionId: l.sectionId ? sectionMap.get(l.sectionId) : null,
          catalogItemId: l.catalogItemId,
          offerId: l.offerId,
          sortOrder: l.sortOrder,
          costType: l.costType,
          nameSnapshot: l.nameSnapshot,
          unitSnapshot: l.unitSnapshot,
          qty: l.qty,
          purchaseQty: l.purchaseQty,
          unitPurchasePrice: l.unitPurchasePrice,
          purchaseVatMode: l.purchaseVatMode,
          purchaseVatRate: l.purchaseVatRate,
          unitSalePrice: l.unitSalePrice,
          saleVatMode: l.saleVatMode,
          saleVatRate: l.saleVatRate,
          priceType: l.priceType,
          confirmationStatus: l.confirmationStatus,
          discountPercent: l.discountPercent,
          discountAmount: l.discountAmount,
          supplierOrganizationId: l.supplierOrganizationId,
          supplierNameSnapshot: l.supplierNameSnapshot,
          sourceLabel: l.sourceLabel,
          sourcedAt: l.sourcedAt,
          unknownPriceReason: l.unknownPriceReason,
        },
      });
      lineMap.set(l.id, nl.id);
    }

    for (const a of source.adjustments) {
      const baseIds = Array.isArray(a.baseLineIds)
        ? (a.baseLineIds as string[]).map((id) => lineMap.get(id) ?? id)
        : [];
      await tx.adjustment.create({
        data: {
          estimateId: created.id,
          name: a.name,
          type: a.type,
          value: a.value,
          baseLineIds: baseIds,
          vatMode: a.vatMode,
          vatRate: a.vatRate,
          applyOrder: a.applyOrder,
          costType: a.costType,
        },
      });
    }

    return created;
  });
}

/** Warn about possible material duplicate vs bundled service — never auto-delete. */
export async function findPossibleDuplicates(estimateId: string) {
  const lines = await prisma.estimateLine.findMany({
    where: { estimateId },
    include: { catalogItem: true },
  });
  const warnings: { lineId: string; message: string }[] = [];
  const services = lines.filter((l) => l.catalogItem?.kind === "service");
  const materials = lines.filter(
    (l) => l.catalogItem?.kind === "product" || l.costType === "material",
  );

  for (const svc of services) {
    const scope = svc.catalogItem?.serviceScope as
      | { included?: string[]; excluded?: string[] }
      | null;
    const included = (scope?.included ?? []).map((s) => s.toLowerCase());
    if (included.length === 0) continue;
    for (const mat of materials) {
      const name = mat.nameSnapshot.toLowerCase();
      if (included.some((inc) => name.includes(inc) || inc.includes(name.slice(0, 8)))) {
        warnings.push({
          lineId: mat.id,
          message: `Возможный дубль: материал «${mat.nameSnapshot}» может входить в услугу «${svc.nameSnapshot}». Строки не удаляются автоматически.`,
        });
      }
    }
  }
  return warnings;
}
