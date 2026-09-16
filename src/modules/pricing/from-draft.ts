import type { EstimateLine, Adjustment, VatMode as DbVatMode } from "@prisma/client";
import {
  calculateCommercialEstimate,
  type AdjustmentInput,
  type CalcLineInput,
  type CalcResult,
  type VatMode,
} from "@/modules/pricing";

function mapVat(mode: DbVatMode | null | undefined): VatMode {
  if (!mode) return "not_specified";
  return mode;
}

export function buildCalcInputFromDraft(opts: {
  lines: EstimateLine[];
  adjustments: Adjustment[];
  inputVatRecoverable?: "true" | "false" | "unknown";
}): { result: CalcResult } {
  const calcLines: CalcLineInput[] = opts.lines.map((l) => {
    const unknown =
      l.unitSalePrice == null ||
      l.priceType === "on_request" ||
      l.confirmationStatus === "pending_quote" ||
      Boolean(l.unknownPriceReason);

    return {
      id: l.id,
      costType: l.costType,
      qty: l.qty.toString(),
      unit: l.unitSnapshot,
      purchase:
        l.unitPurchasePrice != null
          ? {
              unitPrice: l.unitPurchasePrice.toString(),
              vatMode: mapVat(l.purchaseVatMode),
              vatRate: l.purchaseVatRate?.toString() ?? null,
            }
          : undefined,
      purchaseQtyOverride: l.purchaseQty?.toString() ?? null,
      sale: {
        unitPriceExVat: unknown ? null : l.unitSalePrice?.toString() ?? null,
        markupPercent: l.markupPercent?.toString() ?? null,
        targetMarginPercent: l.targetMarginPercent?.toString() ?? null,
        vatMode: mapVat(l.saleVatMode ?? "zero"),
        vatRate: l.saleVatRate?.toString() ?? (l.saleVatMode === "zero" ? "0" : null),
      },
      priceType: l.priceType ?? "fixed",
      lineDiscountPercent: l.discountPercent?.toString() ?? null,
      lineDiscountAmount: l.discountAmount?.toString() ?? null,
      forceUnknown: unknown,
      assumptionNote: l.unknownPriceReason,
    };
  });

  const calcAdj: AdjustmentInput[] = opts.adjustments.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    value: a.value.toString(),
    baseLineIds: Array.isArray(a.baseLineIds)
      ? (a.baseLineIds as string[])
      : [],
    vatMode: mapVat(a.vatMode),
    vatRate: a.vatRate?.toString() ?? (a.vatMode === "zero" ? "0" : null),
    applyOrder: a.applyOrder,
    costType: a.costType,
  }));

  const result = calculateCommercialEstimate(calcLines, calcAdj, null, {
    currency: "KZT",
    inputVatRecoverable: opts.inputVatRecoverable ?? "unknown",
  });

  return { result };
}
