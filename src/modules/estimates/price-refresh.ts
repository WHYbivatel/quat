import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/modules/organizations/access";
import { getEstimateWorkspace } from "@/modules/estimates/draft";
import { bumpRevision, ConflictError } from "@/modules/estimates/versions";
import { NotFoundError } from "@/lib/permissions";

export type PriceDiff = {
  lineId: string;
  name: string;
  offerId: string | null;
  oldPrice: string | null;
  newPrice: string | null;
  oldValidUntil: string | null;
  newValidUntil: string | null;
  changed: boolean;
  offerGone: boolean;
};

export async function compareOfferPrices(userId: string, estimateId: string) {
  const estimate = await getEstimateWorkspace(userId, estimateId);
  const diffs: PriceDiff[] = [];

  for (const line of estimate.lines) {
    if (!line.offerId) continue;
    const offer = await prisma.offer.findUnique({ where: { id: line.offerId } });
    const oldPrice = line.unitPurchasePrice?.toString() ?? null;
    if (!offer || offer.moderationStatus !== "approved") {
      diffs.push({
        lineId: line.id,
        name: line.nameSnapshot,
        offerId: line.offerId,
        oldPrice,
        newPrice: null,
        oldValidUntil: null,
        newValidUntil: null,
        changed: true,
        offerGone: true,
      });
      continue;
    }
    const newPrice =
      offer.priceType === "fixed" && offer.price != null
        ? offer.price.toString()
        : null;
    const changed = oldPrice !== newPrice;
    diffs.push({
      lineId: line.id,
      name: line.nameSnapshot,
      offerId: offer.id,
      oldPrice,
      newPrice,
      oldValidUntil: null,
      newValidUntil: offer.validUntil?.toISOString() ?? null,
      changed,
      offerGone: false,
    });
  }
  return diffs;
}

export async function applyOfferPriceUpdates(opts: {
  userId: string;
  estimateId: string;
  expectedRevision: number;
  lineIds: string[];
}) {
  await requireAuthContext(opts.userId, "estimate:write");
  const estimate = await getEstimateWorkspace(opts.userId, opts.estimateId);
  if (estimate.draftRevision !== opts.expectedRevision) throw new ConflictError();

  for (const line of estimate.lines) {
    if (!opts.lineIds.includes(line.id) || !line.offerId) continue;
    const offer = await prisma.offer.findUnique({
      where: { id: line.offerId },
      include: { supplier: true },
    });
    if (!offer) continue;
    const fixed = offer.priceType === "fixed" && offer.price != null;
    await prisma.estimateLine.update({
      where: { id: line.id },
      data: {
        unitPurchasePrice: fixed ? offer.price : null,
        purchaseVatMode: offer.inputVatMode,
        purchaseVatRate: offer.inputVatRate,
        unitSalePrice: fixed ? offer.price : line.unitSalePrice,
        priceType: offer.priceType,
        sourcedAt: offer.updatedAt,
        unknownPriceReason: fixed ? null : offer.unknownPriceReason ?? "Цена не фиксирована",
        confirmationStatus: fixed ? "draft" : "pending_quote",
      },
    });
  }

  return bumpRevision(estimate.id, opts.expectedRevision);
}

export async function applyTemplate(opts: {
  userId: string;
  projectId: string;
  templateCode: string;
}) {
  await requireAuthContext(opts.userId, "estimate:write");
  const template = await prisma.estimateTemplate.findUnique({
    where: { code: opts.templateCode },
  });
  if (!template) throw new NotFoundError("Template not found");

  const { ensureDraftEstimate } = await import("@/modules/estimates/draft");
  const estimate = await ensureDraftEstimate(opts.userId, opts.projectId);

  const payload = template.payload as {
    assumptions?: string[];
    sections?: string[];
    lines?: Array<{
      sku?: string;
      name: string;
      unit: string;
      qty: string;
      costType: string;
      unitSalePrice?: string;
      kind?: string;
    }>;
  };

  // Clear empty draft lines only if draft is empty-ish
  if (estimate.lines.length === 0 && payload.lines?.length) {
    // ensure sections
    const sectionIds: string[] = [];
    for (const [i, title] of (payload.sections ?? ["Позиции"]).entries()) {
      let section = estimate.sections.find((s) => s.title === title);
      if (!section) {
        section = await prisma.estimateSection.create({
          data: { estimateId: estimate.id, title, sortOrder: i },
        });
      }
      sectionIds.push(section.id);
    }

    let sort = 0;
    for (const row of payload.lines) {
      let catalogItemId: string | null = null;
      if (row.sku) {
        const item = await prisma.catalogItem.findFirst({
          where: { sku: row.sku },
        });
        catalogItemId = item?.id ?? null;
      }
      await prisma.estimateLine.create({
        data: {
          estimateId: estimate.id,
          sectionId: sectionIds[0],
          catalogItemId,
          sortOrder: sort++,
          costType: (row.costType as "material") ?? "material",
          nameSnapshot: row.name,
          unitSnapshot: row.unit,
          qty: row.qty,
          unitSalePrice: row.unitSalePrice ?? null,
          saleVatMode: "zero",
          saleVatRate: "0",
          priceType: row.unitSalePrice ? "fixed" : "on_request",
          confirmationStatus: row.unitSalePrice ? "draft" : "pending_quote",
          unknownPriceReason: row.unitSalePrice ? null : "Учебная позиция шаблона",
          sourceLabel: `Шаблон ${template.code} (учебный)`,
          sourcedAt: new Date(),
          manualOverrideReason: "Демо-шаблон — проверить инженером",
        },
      });
    }

    if (payload.assumptions?.length) {
      await prisma.project.update({
        where: { id: opts.projectId },
        data: {
          assumptions: [
            "Допущения шаблона (учебные):",
            ...payload.assumptions,
            "Запас кабеля не увеличивает длину прокладки автоматически.",
          ].join("\n"),
        },
      });
    }
  }

  await prisma.estimate.update({
    where: { id: estimate.id },
    data: {
      title: template.nameRu,
      draftRevision: { increment: 1 },
      terms: "Коммерческое предложение по учебным ценам. Не нормативная ПСД.",
    },
  });

  return estimate;
}

export async function listTemplates() {
  return prisma.estimateTemplate.findMany({
    where: { isSystem: true },
    orderBy: { nameRu: "asc" },
  });
}
