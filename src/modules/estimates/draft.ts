import type { CostType, PriceType, VatMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/modules/organizations/access";
import { NotFoundError } from "@/lib/permissions";
import { getProjectForUser } from "@/modules/projects/service";

function costTypeForKind(kind: string): CostType {
  return kind === "service" ? "labor" : "material";
}

export async function ensureDraftEstimate(
  userId: string,
  projectId: string,
) {
  const project = await getProjectForUser(userId, projectId);
  await requireAuthContext(userId, "estimate:write");

  const existing = await prisma.estimate.findFirst({
    where: { projectId: project.id, status: "draft" },
    orderBy: { updatedAt: "desc" },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
      lines: { orderBy: { sortOrder: "asc" } },
      adjustments: { orderBy: { applyOrder: "asc" } },
    },
  });
  if (existing) return existing;

  const count = await prisma.estimate.count({ where: { projectId: project.id } });
  return prisma.estimate.create({
    data: {
      projectId: project.id,
      number: `СМ-${String(count + 1).padStart(3, "0")}`,
      title: "Черновик сметы",
      status: "draft",
      sections: {
        create: [
          { title: "Оборудование и материалы", sortOrder: 0 },
          { title: "Работы", sortOrder: 1 },
        ],
      },
    },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
      lines: { orderBy: { sortOrder: "asc" } },
      adjustments: { orderBy: { applyOrder: "asc" } },
    },
  });
}

export async function getEstimateWorkspace(userId: string, estimateId: string) {
  const ctx = await requireAuthContext(userId, "estimate:read");
  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: {
      project: { include: { city: true } },
      sections: { orderBy: { sortOrder: "asc" } },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: { catalogItem: true, offer: true },
      },
      adjustments: { orderBy: { applyOrder: "asc" } },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 20,
        select: {
          id: true,
          versionNumber: true,
          issuedAt: true,
          documentKind: true,
          calculationPolicyVersion: true,
        },
      },
    },
  });
  if (!estimate || estimate.project.organizationId !== ctx.organizationId) {
    throw new NotFoundError("Estimate not found");
  }
  return estimate;
}

export async function addCatalogItemToDraft(opts: {
  userId: string;
  projectId: string;
  catalogItemId: string;
  offerId?: string;
  qty?: string;
}) {
  await requireAuthContext(opts.userId, "estimate:write");
  const estimate = await ensureDraftEstimate(opts.userId, opts.projectId);

  const item = await prisma.catalogItem.findFirst({
    where: { id: opts.catalogItemId, status: "active" },
    include: { baseUnit: true },
  });
  if (!item) throw new NotFoundError("Catalog item not found");

  let offer = null;
  if (opts.offerId) {
    offer = await prisma.offer.findFirst({
      where: {
        id: opts.offerId,
        catalogItemId: item.id,
        moderationStatus: "approved",
      },
      include: { supplier: true },
    });
    if (!offer) throw new NotFoundError("Offer not found");
  }

  const section =
    estimate.sections.find((s) =>
      item.kind === "service"
        ? s.title.toLowerCase().includes("работ")
        : s.title.toLowerCase().includes("материал") ||
          s.title.toLowerCase().includes("оборуд"),
    ) ?? estimate.sections[0];

  const priceType = (offer?.priceType ?? "on_request") as PriceType;
  const unitPurchase =
    offer && offer.priceType === "fixed" && offer.price != null
      ? offer.price
      : null;
  const unknownReason =
    !unitPurchase
      ? offer?.unknownPriceReason ??
        (priceType === "on_request"
          ? "Цена по запросу"
          : priceType === "from" || priceType === "range"
            ? "Предварительная цена — не фиксированная"
            : "Цена не указана")
      : null;

  const maxSort =
    estimate.lines.reduce((m, l) => Math.max(m, l.sortOrder), -1) + 1;

  const line = await prisma.estimateLine.create({
    data: {
      estimateId: estimate.id,
      sectionId: section?.id,
      catalogItemId: item.id,
      offerId: offer?.id,
      sortOrder: maxSort,
      costType: costTypeForKind(item.kind),
      nameSnapshot: item.name,
      unitSnapshot: item.baseUnit.code,
      qty: opts.qty ?? "1",
      unitPurchasePrice: unitPurchase,
      purchaseVatMode: (offer?.inputVatMode as VatMode | undefined) ?? null,
      purchaseVatRate: offer?.inputVatRate ?? null,
      // Sale price left empty until calc module (Prompt 3); UI shows purchase as reference
      unitSalePrice: unitPurchase,
      saleVatMode: (offer?.inputVatMode as VatMode | undefined) ?? null,
      saleVatRate: offer?.inputVatRate ?? null,
      priceType,
      confirmationStatus: unitPurchase ? "draft" : "pending_quote",
      supplierOrganizationId: offer?.supplierOrganizationId,
      supplierNameSnapshot: offer?.supplier.name,
      sourceLabel: offer
        ? `Offer ${offer.id.slice(0, 8)} · демо`
        : "Без предложения",
      sourcedAt: offer?.updatedAt ?? new Date(),
      unknownPriceReason: unknownReason,
    },
  });

  await prisma.estimate.update({
    where: { id: estimate.id },
    data: { draftRevision: { increment: 1 } },
  });

  return { estimateId: estimate.id, projectId: opts.projectId, lineId: line.id };
}

export async function updateDraftLineQty(opts: {
  userId: string;
  lineId: string;
  qty: string;
  expectedRevision?: number;
}) {
  await requireAuthContext(opts.userId, "estimate:write");
  const line = await prisma.estimateLine.findUnique({
    where: { id: opts.lineId },
    include: { estimate: { include: { project: true } } },
  });
  if (!line) throw new NotFoundError("Line not found");
  const ctx = await requireAuthContext(opts.userId, "estimate:write");
  if (line.estimate.project.organizationId !== ctx.organizationId) {
    throw new NotFoundError("Line not found");
  }
  if (
    opts.expectedRevision != null &&
    line.estimate.draftRevision !== opts.expectedRevision
  ) {
    const { ConflictError } = await import("@/modules/estimates/versions");
    throw new ConflictError();
  }
  await prisma.estimateLine.update({
    where: { id: line.id },
    data: { qty: opts.qty },
  });
  await prisma.estimate.update({
    where: { id: line.estimateId },
    data: { draftRevision: { increment: 1 } },
  });
  return line.estimate.draftRevision + 1;
}

export async function removeDraftLine(opts: {
  userId: string;
  lineId: string;
  expectedRevision?: number;
}) {
  await requireAuthContext(opts.userId, "estimate:write");
  const line = await prisma.estimateLine.findUnique({
    where: { id: opts.lineId },
    include: { estimate: { include: { project: true } } },
  });
  if (!line) throw new NotFoundError("Line not found");
  const ctx = await requireAuthContext(opts.userId, "estimate:write");
  if (line.estimate.project.organizationId !== ctx.organizationId) {
    throw new NotFoundError("Line not found");
  }
  if (
    opts.expectedRevision != null &&
    line.estimate.draftRevision !== opts.expectedRevision
  ) {
    const { ConflictError } = await import("@/modules/estimates/versions");
    throw new ConflictError();
  }
  await prisma.estimateLine.delete({ where: { id: line.id } });
  await prisma.estimate.update({
    where: { id: line.estimateId },
    data: { draftRevision: { increment: 1 } },
  });
  return line.estimate.draftRevision + 1;
}

/** Rough known subtotal for UI until CalcEngine (Prompt 3). Not authoritative. */
export function roughKnownSubtotal(
  lines: {
    qty: { toString(): string };
    unitSalePrice: { toString(): string } | null;
    unknownPriceReason: string | null;
  }[],
): { known: string; unknownCount: number; complete: boolean } {
  let sum = 0;
  let unknownCount = 0;
  for (const line of lines) {
    if (line.unitSalePrice == null || line.unknownPriceReason) {
      unknownCount += 1;
      continue;
    }
    sum += Number(line.qty.toString()) * Number(line.unitSalePrice.toString());
  }
  return {
    known: sum.toFixed(2),
    unknownCount,
    complete: unknownCount === 0 && lines.length > 0,
  };
}
