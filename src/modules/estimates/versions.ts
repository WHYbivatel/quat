import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFoundError, AccessDeniedError } from "@/lib/permissions";
import { requireAuthContext } from "@/modules/organizations/access";
import { getEstimateWorkspace } from "@/modules/estimates/draft";
import { buildCalcInputFromDraft } from "@/modules/pricing/from-draft";
import type { CalcResult } from "@/modules/pricing";

export class ConflictError extends Error {
  constructor(message = "Conflict: draft was modified in another tab") {
    super(message);
    this.name = "ConflictError";
  }
}

export class VersionBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VersionBlockedError";
  }
}

async function assertDraftRevision(
  estimateId: string,
  expectedRevision: number,
  organizationId: string,
) {
  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: { project: true },
  });
  if (!estimate || estimate.project.organizationId !== organizationId) {
    throw new NotFoundError("Estimate not found");
  }
  if (estimate.draftRevision !== expectedRevision) {
    throw new ConflictError(
      `Ожидалась ревизия ${expectedRevision}, сейчас ${estimate.draftRevision}`,
    );
  }
  return estimate;
}

export async function bumpRevision(estimateId: string, expectedRevision: number) {
  const updated = await prisma.estimate.updateMany({
    where: { id: estimateId, draftRevision: expectedRevision },
    data: { draftRevision: { increment: 1 } },
  });
  if (updated.count !== 1) {
    throw new ConflictError();
  }
  return expectedRevision + 1;
}

export type EstimateSnapshot = {
  estimate: {
    id: string;
    number: string;
    title: string;
    currency: string;
    terms: string | null;
    exclusions: string | null;
    offerValidUntil: string | null;
    proposalStatus: string;
    calculationPolicyVersion: string;
  };
  project: {
    id: string;
    name: string;
    objectName: string | null;
    objectAddress: string | null;
    clientName: string | null;
    cityName: string | null;
    assumptions: string | null;
    description: string | null;
    timezone: string;
  };
  sections: { id: string; title: string; sortOrder: number }[];
  lines: Array<Record<string, unknown>>;
  adjustments: Array<Record<string, unknown>>;
  issuedAt: string;
};

export async function buildSnapshot(
  userId: string,
  estimateId: string,
): Promise<{ snapshot: EstimateSnapshot; calc: CalcResult }> {
  const estimate = await getEstimateWorkspace(userId, estimateId);

  const { result: calc } = buildCalcInputFromDraft({
    lines: estimate.lines,
    adjustments: estimate.adjustments,
  });

  const snapshot: EstimateSnapshot = {
    estimate: {
      id: estimate.id,
      number: estimate.number,
      title: estimate.title,
      currency: estimate.currency,
      terms: estimate.terms,
      exclusions: estimate.exclusions,
      offerValidUntil: estimate.offerValidUntil?.toISOString() ?? null,
      proposalStatus: estimate.proposalStatus,
      calculationPolicyVersion: estimate.calculationPolicyVersion,
    },
    project: {
      id: estimate.project.id,
      name: estimate.project.name,
      objectName: estimate.project.objectName,
      objectAddress: estimate.project.objectAddress,
      clientName: estimate.project.clientName,
      cityName: estimate.project.city?.nameRu ?? null,
      assumptions: estimate.project.assumptions,
      description: estimate.project.description,
      timezone: estimate.project.timezone,
    },
    sections: estimate.sections.map((s) => ({
      id: s.id,
      title: s.title,
      sortOrder: s.sortOrder,
    })),
    lines: estimate.lines.map((l) => ({
      id: l.id,
      sectionId: l.sectionId,
      catalogItemId: l.catalogItemId,
      offerId: l.offerId,
      sortOrder: l.sortOrder,
      costType: l.costType,
      nameSnapshot: l.nameSnapshot,
      unitSnapshot: l.unitSnapshot,
      qty: l.qty.toString(),
      purchaseQty: l.purchaseQty?.toString() ?? null,
      unitPurchasePrice: l.unitPurchasePrice?.toString() ?? null,
      purchaseVatMode: l.purchaseVatMode,
      purchaseVatRate: l.purchaseVatRate?.toString() ?? null,
      unitSalePrice: l.unitSalePrice?.toString() ?? null,
      saleVatMode: l.saleVatMode,
      saleVatRate: l.saleVatRate?.toString() ?? null,
      priceType: l.priceType,
      confirmationStatus: l.confirmationStatus,
      discountPercent: l.discountPercent?.toString() ?? null,
      discountAmount: l.discountAmount?.toString() ?? null,
      markupPercent: l.markupPercent?.toString() ?? null,
      targetMarginPercent: l.targetMarginPercent?.toString() ?? null,
      supplierOrganizationId: l.supplierOrganizationId,
      supplierNameSnapshot: l.supplierNameSnapshot,
      sourceLabel: l.sourceLabel,
      sourcedAt: l.sourcedAt?.toISOString() ?? null,
      unknownPriceReason: l.unknownPriceReason,
      manualOverrideReason: l.manualOverrideReason,
      includedInServiceLineId: l.includedInServiceLineId,
      notesInternal: l.notesInternal,
    })),
    adjustments: estimate.adjustments.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      value: a.value.toString(),
      baseLineIds: a.baseLineIds,
      vatMode: a.vatMode,
      vatRate: a.vatRate?.toString() ?? null,
      applyOrder: a.applyOrder,
      costType: a.costType,
    })),
    issuedAt: new Date().toISOString(),
  };

  return { snapshot, calc };
}

/** Client-safe DTO — never includes purchase/margin/internal notes. */
export function toClientEstimateDto(
  snapshot: EstimateSnapshot,
  calc: CalcResult,
) {
  return {
    documentKind: calc.complete ? "commercial_fixed" : "commercial_preliminary",
    calculationPolicyVersion: calc.calculationPolicyVersion,
    currency: snapshot.estimate.currency,
    estimate: {
      number: snapshot.estimate.number,
      title: snapshot.estimate.title,
      terms: snapshot.estimate.terms,
      exclusions: snapshot.estimate.exclusions,
      offerValidUntil: snapshot.estimate.offerValidUntil,
    },
    project: {
      name: snapshot.project.name,
      objectName: snapshot.project.objectName,
      objectAddress: snapshot.project.objectAddress,
      clientName: snapshot.project.clientName,
      cityName: snapshot.project.cityName,
      assumptions: snapshot.project.assumptions,
    },
    sections: snapshot.sections,
    lines: snapshot.lines.map((l) => ({
      id: l.id,
      sectionId: l.sectionId,
      sortOrder: l.sortOrder,
      costType: l.costType,
      name: l.nameSnapshot,
      unit: l.unitSnapshot,
      qty: l.qty,
      unitSalePrice: l.unitSalePrice,
      saleVatMode: l.saleVatMode,
      saleVatRate: l.saleVatRate,
      priceType: l.priceType,
      discountPercent: l.discountPercent,
      discountAmount: l.discountAmount,
      supplierName: l.supplierNameSnapshot,
      unknownPriceReason: l.unknownPriceReason,
      // explicitly omitted: unitPurchasePrice, markup, margin, notesInternal
    })),
    adjustments: snapshot.adjustments.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      value: a.value,
      applyOrder: a.applyOrder,
      costType: a.costType,
      vatMode: a.vatMode,
      vatRate: a.vatRate,
    })),
    totals: {
      complete: calc.complete,
      knownSubtotal: calc.knownSubtotal,
      grandTotal: calc.grandTotal,
      linesExVat: calc.linesExVat,
      adjustmentsExVat: calc.adjustmentsExVat,
      outputVatTotal: calc.outputVatTotal,
      unknownLineCount: calc.unknownLineCount,
      breakdownByCostType: calc.breakdownByCostType,
    },
    lineResults: calc.lines.map((l) => ({
      id: l.id,
      known: l.known,
      unitSaleExVat: l.unitSaleExVat,
      lineNetExVat: l.lineNetExVat,
      outputVat: l.outputVat,
    })),
    disclaimer:
      "Коммерческий расчёт. Не является нормативной ПСД. Принятие в портале не является ЭЦП.",
  };
}

export async function issueEstimateVersion(opts: {
  userId: string;
  estimateId: string;
  expectedRevision: number;
  allowPreliminary?: boolean;
}) {
  const ctx = await requireAuthContext(opts.userId, "estimate:issue");
  await assertDraftRevision(opts.estimateId, opts.expectedRevision, ctx.organizationId);

  const { snapshot, calc } = await buildSnapshot(opts.userId, opts.estimateId);

  if (!calc.complete && !opts.allowPreliminary) {
    throw new VersionBlockedError(
      "Есть неизвестные цены или налог — выпуск фиксированной версии запрещён. Используйте предварительную.",
    );
  }

  const last = await prisma.estimateVersion.findFirst({
    where: { estimateId: opts.estimateId },
    orderBy: { versionNumber: "desc" },
  });
  const versionNumber = (last?.versionNumber ?? 0) + 1;

    const version = await prisma.$transaction(async (tx) => {
    const v = await tx.estimateVersion.create({
      data: {
        estimateId: opts.estimateId,
        versionNumber,
        issuedById: opts.userId,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        calcResult: calc as unknown as Prisma.InputJsonValue,
        calculationPolicyVersion: calc.calculationPolicyVersion,
        documentKind: calc.complete ? "commercial_fixed" : "commercial_preliminary",
        immutable: true,
      },
    });
    const bumped = await tx.estimate.updateMany({
      where: { id: opts.estimateId, draftRevision: opts.expectedRevision },
      data: { draftRevision: { increment: 1 } },
    });
    if (bumped.count !== 1) {
      throw new ConflictError();
    }
    return v;
  });

  return { version, calc, snapshot };
}

export async function listVersions(userId: string, estimateId: string) {
  await getEstimateWorkspace(userId, estimateId);
  return prisma.estimateVersion.findMany({
    where: { estimateId },
    orderBy: { versionNumber: "desc" },
    select: {
      id: true,
      versionNumber: true,
      issuedAt: true,
      documentKind: true,
      calculationPolicyVersion: true,
      immutable: true,
    },
  });
}

export async function getVersionForUser(userId: string, versionId: string) {
  const ctx = await requireAuthContext(userId, "estimate:read");
  const version = await prisma.estimateVersion.findUnique({
    where: { id: versionId },
    include: {
      estimate: { include: { project: true } },
      publicLinks: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!version || version.estimate.project.organizationId !== ctx.organizationId) {
    throw new NotFoundError("Version not found");
  }
  return version;
}

export async function createPublicLink(opts: {
  userId: string;
  versionId: string;
  expiresInDays?: number;
}) {
  await requireAuthContext(opts.userId, "estimate:issue");
  const version = await getVersionForUser(opts.userId, opts.versionId);
  const token = randomBytes(32).toString("base64url");
  const expiresAt =
    opts.expiresInDays != null
      ? new Date(Date.now() + opts.expiresInDays * 86400000)
      : null;

  return prisma.publicEstimateLink.create({
    data: {
      versionId: version.id,
      token,
      expiresAt,
      createdById: opts.userId,
    },
  });
}

export async function revokePublicLink(opts: {
  userId: string;
  linkId: string;
}) {
  const ctx = await requireAuthContext(opts.userId, "estimate:issue");
  const link = await prisma.publicEstimateLink.findUnique({
    where: { id: opts.linkId },
    include: {
      version: { include: { estimate: { include: { project: true } } } },
    },
  });
  if (
    !link ||
    link.version.estimate.project.organizationId !== ctx.organizationId
  ) {
    throw new NotFoundError("Link not found");
  }
  return prisma.publicEstimateLink.update({
    where: { id: link.id },
    data: { revokedAt: new Date() },
  });
}

export async function getPublicEstimateByToken(token: string) {
  const link = await prisma.publicEstimateLink.findUnique({
    where: { token },
    include: { version: true },
  });
  if (!link || link.revokedAt) return null;
  if (link.expiresAt && link.expiresAt < new Date()) return null;

  const snapshot = link.version.snapshot as unknown as EstimateSnapshot;
  const calc = link.version.calcResult as unknown as CalcResult;
  return {
    link,
    version: link.version,
    clientDto: toClientEstimateDto(snapshot, calc),
  };
}

export { AccessDeniedError, NotFoundError };
