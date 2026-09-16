import type { CalcResult } from "@/modules/pricing";
import type { EstimateSnapshot } from "@/modules/estimates/versions";
import type { ExportDocumentModel, ExportVariant } from "./sanitize";

export function buildExportModel(opts: {
  snapshot: EstimateSnapshot;
  calc: CalcResult;
  variant: ExportVariant;
  versionNumber: number;
  versionLabel?: string;
  preliminary?: boolean;
  composerName?: string | null;
}): ExportDocumentModel {
  const { snapshot, calc, variant } = opts;
  const preliminary =
    opts.preliminary ??
    (!calc.complete || snapshot.estimate.proposalStatus === "prepared");

  const lineById = new Map(calc.lines.map((l) => [l.id, l]));

  const rows = snapshot.lines.map((raw) => {
    const id = String(raw.id);
    const section =
      snapshot.sections.find((s) => s.id === raw.sectionId)?.title ?? "Без раздела";
    const lr = lineById.get(id);
    const row = {
      sectionTitle: section,
      name: String(raw.nameSnapshot ?? ""),
      unit: String(raw.unitSnapshot ?? ""),
      qty: String(raw.qty ?? "0"),
      unitPrice: raw.unitSalePrice != null ? String(raw.unitSalePrice) : null,
      discount:
        raw.discountPercent != null
          ? `${raw.discountPercent}%`
          : raw.discountAmount != null
            ? String(raw.discountAmount)
            : null,
      lineNet: lr?.lineNetExVat ?? null,
      outputVat: lr?.outputVat ?? null,
      costType: String(raw.costType ?? "other"),
      purchasePrice:
        variant === "internal" && raw.unitPurchasePrice != null
          ? String(raw.unitPurchasePrice)
          : undefined,
      supplier:
        variant === "internal"
          ? (raw.supplierNameSnapshot as string | null) ?? null
          : undefined,
      notesInternal:
        variant === "internal"
          ? (raw.notesInternal as string | null) ?? null
          : undefined,
    };
    return row;
  });

  const unknownLines = snapshot.lines
    .filter((raw) => {
      const lr = lineById.get(String(raw.id));
      return !lr?.known;
    })
    .map((raw) => ({
      name: String(raw.nameSnapshot ?? ""),
      reason: (raw.unknownPriceReason as string | null) ?? null,
    }));

  return {
    title: snapshot.estimate.title,
    documentType: preliminary
      ? "Коммерческая смета — предварительный расчёт"
      : "Коммерческая смета",
    number: snapshot.estimate.number,
    versionLabel: opts.versionLabel ?? `v${opts.versionNumber}`,
    issuedAt: snapshot.issuedAt,
    currency: snapshot.estimate.currency,
    city: snapshot.project.cityName,
    objectName: snapshot.project.objectName,
    clientName: snapshot.project.clientName,
    composerName: opts.composerName ?? null,
    terms: snapshot.estimate.terms,
    exclusions: snapshot.estimate.exclusions,
    offerValidUntil: snapshot.estimate.offerValidUntil,
    assumptions: snapshot.project.assumptions,
    preliminary,
    variant,
    policyVersion: calc.calculationPolicyVersion,
    rows,
    adjustments: calc.adjustments.map((a) => ({
      name: a.name,
      amount: a.amountExVat,
      vat: a.outputVat,
    })),
    unknownLines,
    totals: {
      linesExVat: calc.linesExVat,
      adjustmentsExVat: calc.adjustmentsExVat,
      outputVatTotal: calc.outputVatTotal,
      knownSubtotal: calc.knownSubtotal,
      grandTotal: calc.grandTotal,
      complete: calc.complete,
    },
    internalNote:
      variant === "internal"
        ? "ВНУТРЕННИЙ ДОКУМЕНТ: содержит закупочные данные. Не для клиента."
        : null,
  };
}

/** Canonical totals string for cross-format equality checks. */
export function canonicalTotals(model: ExportDocumentModel): string {
  return [
    model.totals.linesExVat,
    model.totals.adjustmentsExVat,
    model.totals.outputVatTotal,
    model.totals.knownSubtotal,
    model.totals.grandTotal ?? "null",
  ].join("|");
}
