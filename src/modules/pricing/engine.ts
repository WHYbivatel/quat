import { Decimal, d } from "@/lib/decimal";

export const CALCULATION_POLICY_VERSION = "commercial-v1" as const;

export type CostType =
  | "equipment"
  | "material"
  | "labor"
  | "machinery"
  | "logistics"
  | "other";

export type VatMode = "included" | "excluded" | "zero" | "not_specified";
export type PriceType = "fixed" | "from" | "range" | "on_request";
export type RecoverableVat = "true" | "false" | "unknown";

export type CalcLineInput = {
  id: string;
  costType: CostType;
  qty: string;
  unit: string;
  purchase?: {
    unitPrice?: string | null;
    vatMode: VatMode;
    vatRate?: string | null;
    packQty?: string | null;
    moq?: string | null;
  };
  purchaseQtyOverride?: string | null;
  sale?: {
    unitPriceExVat?: string | null;
    markupPercent?: string | null;
    targetMarginPercent?: string | null;
    costBaseExVat?: string | null;
    vatMode: VatMode;
    vatRate?: string | null;
  };
  priceType?: PriceType;
  lineDiscountPercent?: string | null;
  lineDiscountAmount?: string | null;
  /** Force unknown even if numbers present (e.g. on_request). */
  forceUnknown?: boolean;
  assumptionNote?: string | null;
};

export type GlobalDiscountInput = {
  amount: string;
  lineIds: string[];
};

export type AdjustmentInput = {
  id: string;
  name: string;
  type: "amount" | "percent";
  value: string;
  baseLineIds: string[];
  vatMode: VatMode;
  vatRate?: string | null;
  applyOrder: number;
  costType?: CostType;
};

export type CalcContext = {
  currency?: string;
  inputVatRecoverable?: RecoverableVat;
  taxRuleDate?: string;
};

export type CalcIssue = {
  code: string;
  message: string;
  lineId?: string;
  adjustmentId?: string;
};

export type CalcLineResult = {
  id: string;
  costType: CostType;
  qty: string;
  unit: string;
  known: boolean;
  purchaseQty: string | null;
  purchaseUnitExVat: string | null;
  purchaseInputVat: string | null;
  unitSaleExVat: string | null;
  lineGrossExVat: string | null;
  lineDiscountExVat: string | null;
  afterLineDiscountExVat: string | null;
  globalDiscountAllocated: string | null;
  lineNetExVat: string | null;
  outputVat: string | null;
  outputVatMode: VatMode | null;
  assumptionNote: string | null;
  issues: CalcIssue[];
};

export type CalcAdjustmentResult = {
  id: string;
  name: string;
  amountExVat: string;
  outputVat: string | null;
  vatMode: VatMode;
  costType: CostType;
};

export type CalcResult = {
  calculationPolicyVersion: typeof CALCULATION_POLICY_VERSION;
  currency: string;
  complete: boolean;
  unknownLineCount: number;
  linesExVat: string;
  adjustmentsExVat: string;
  outputVatTotal: string;
  /** Present when complete; otherwise use knownSubtotal label in UI. */
  grandTotal: string | null;
  knownSubtotal: string;
  lines: CalcLineResult[];
  adjustments: CalcAdjustmentResult[];
  breakdownByCostType: Record<string, string>;
  breakdownByVatMode: Record<string, string>;
  internal: {
    purchaseCostExVat: string | null;
    inputVatTotal: string | null;
    inputVatRecoverable: RecoverableVat;
    contributionBeforeProfitTax: string | null;
    profitabilityStatus: "ok" | "unavailable" | "negative";
    notes: string[];
  };
  issues: CalcIssue[];
  blockedForFixedVersion: boolean;
};

function money(x: Decimal): string {
  return x.toFixed(2);
}

function round2(x: Decimal): Decimal {
  return x.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function ceilToPack(qty: Decimal, packQty: Decimal | null): Decimal {
  if (!packQty || packQty.lte(0)) return qty;
  const n = qty.div(packQty).toDecimalPlaces(0, Decimal.ROUND_CEIL);
  return n.mul(packQty);
}

export function normalizeToExVat(
  unitPrice: Decimal,
  vatMode: VatMode,
  vatRate: string | null | undefined,
): { exVat: Decimal | null; inputVatPerUnit: Decimal | null; issue?: CalcIssue } {
  if (vatMode === "not_specified") {
    return {
      exVat: null,
      inputVatPerUnit: null,
      issue: {
        code: "purchase_vat_unspecified",
        message: "НДС входной не указан — нельзя подтвердить цену без НДС",
      },
    };
  }
  if (vatMode === "excluded" || vatMode === "zero") {
    return { exVat: unitPrice, inputVatPerUnit: d(0) };
  }
  // included
  if (vatRate == null || vatRate === "") {
    return {
      exVat: null,
      inputVatPerUnit: null,
      issue: {
        code: "purchase_vat_rate_missing",
        message: "Режим «НДС включён», но ставка неизвестна",
      },
    };
  }
  const r = d(vatRate);
  const divisor = d(1).plus(r.div(100));
  const ex = unitPrice.div(divisor);
  const vat = unitPrice.minus(ex);
  return { exVat: ex, inputVatPerUnit: vat };
}

function computePurchaseQty(
  qty: Decimal,
  purchase?: CalcLineInput["purchase"],
  override?: string | null,
): Decimal {
  if (override != null && override !== "") return d(override);
  const moq = purchase?.moq ? d(purchase.moq) : d(0);
  const need = Decimal.max(qty, moq);
  const pack = purchase?.packQty ? d(purchase.packQty) : null;
  return ceilToPack(need, pack);
}

function allocateGlobalDiscount(
  amount: Decimal,
  bases: { id: string; amount: Decimal }[],
): Map<string, Decimal> {
  const result = new Map<string, Decimal>();
  if (bases.length === 0) return result;
  const totalBase = bases.reduce((s, b) => s.plus(b.amount), d(0));
  if (totalBase.lte(0)) {
    throw Object.assign(new Error("Global discount base is zero"), {
      code: "global_discount_base_zero",
    });
  }
  if (amount.gt(totalBase)) {
    throw Object.assign(new Error("Global discount exceeds base"), {
      code: "global_discount_too_large",
    });
  }

  const sorted = [...bases].sort((a, b) => a.id.localeCompare(b.id));
  let allocated = d(0);
  for (const b of sorted) {
    const share = round2(amount.mul(b.amount).div(totalBase));
    result.set(b.id, share);
    allocated = allocated.plus(share);
  }

  let remainder = amount.minus(allocated);
  // Deterministic 0.01 distribution
  const step = remainder.gte(0) ? d("0.01") : d("-0.01");
  let i = 0;
  while (remainder.abs().gte("0.005") && i < sorted.length * 100) {
    const id = sorted[i % sorted.length].id;
    const cur = result.get(id) ?? d(0);
    const next = cur.plus(step);
    const base = sorted[i % sorted.length].amount;
    if (next.gte(0) && next.lte(base)) {
      result.set(id, next);
      remainder = remainder.minus(step);
    }
    i += 1;
  }

  // Final assert equality within 0.00
  const sum = [...result.values()].reduce((s, v) => s.plus(v), d(0));
  if (!sum.eq(amount)) {
    // Force-fix last eligible line
    const last = sorted[sorted.length - 1];
    const cur = result.get(last.id) ?? d(0);
    result.set(last.id, cur.plus(amount.minus(sum)));
  }
  return result;
}

function outputVatFor(
  netExVat: Decimal,
  vatMode: VatMode,
  vatRate: string | null | undefined,
  refId: string,
  kind: "line" | "adjustment",
): { vat: Decimal | null; issues: CalcIssue[] } {
  const issues: CalcIssue[] = [];
  if (vatMode === "included") {
    issues.push({
      code: "sale_vat_included_forbidden",
      message: "Для продажи в commercial-v1 режим included запрещён — передайте ex-VAT",
      ...(kind === "line" ? { lineId: refId } : { adjustmentId: refId }),
    });
    return { vat: null, issues };
  }
  if (vatMode === "not_specified") {
    issues.push({
      code: "sale_vat_unspecified",
      message: "Выходной НДС не указан",
      ...(kind === "line" ? { lineId: refId } : { adjustmentId: refId }),
    });
    return { vat: null, issues };
  }
  if (vatMode === "zero") {
    return { vat: d(0), issues };
  }
  // excluded
  if (vatRate == null || vatRate === "") {
    issues.push({
      code: "sale_vat_rate_missing",
      message: "Ставка выходного НДС не задана",
      ...(kind === "line" ? { lineId: refId } : { adjustmentId: refId }),
    });
    return { vat: null, issues };
  }
  return { vat: round2(netExVat.mul(d(vatRate)).div(100)), issues };
}

export class CalcValidationError extends Error {
  issues: CalcIssue[];
  constructor(issues: CalcIssue[]) {
    super(issues.map((i) => i.message).join("; "));
    this.name = "CalcValidationError";
    this.issues = issues;
  }
}

export function calculateCommercialEstimate(
  lines: CalcLineInput[],
  adjustments: AdjustmentInput[] = [],
  globalDiscount?: GlobalDiscountInput | null,
  context: CalcContext = {},
): CalcResult {
  const issues: CalcIssue[] = [];
  const recoverable = context.inputVatRecoverable ?? "unknown";
  const currency = context.currency ?? "KZT";

  type Working = {
    input: CalcLineInput;
    known: boolean;
    qty: Decimal;
    purchaseQty: Decimal | null;
    purchaseUnitExVat: Decimal | null;
    purchaseInputVatTotal: Decimal | null;
    unitSaleExVat: Decimal | null;
    lineGross: Decimal | null;
    lineDiscount: Decimal | null;
    afterLineDiscount: Decimal | null;
    globalAlloc: Decimal;
    lineNet: Decimal | null;
    outputVat: Decimal | null;
    outputVatMode: VatMode | null;
    lineIssues: CalcIssue[];
  };

  const working: Working[] = lines.map((input) => {
    const lineIssues: CalcIssue[] = [];
    const qty = d(input.qty);
    if (qty.lt(0)) {
      throw new CalcValidationError([
        { code: "negative_qty", message: "Количество не может быть отрицательным", lineId: input.id },
      ]);
    }

    const sale = input.sale;
    if (sale?.markupPercent != null && sale?.targetMarginPercent != null) {
      throw new CalcValidationError([
        {
          code: "markup_and_margin",
          message: "Нельзя одновременно задавать наценку и целевую маржу",
          lineId: input.id,
        },
      ]);
    }
    if (sale?.vatMode === "included") {
      lineIssues.push({
        code: "sale_vat_included_forbidden",
        message: "sale.vatMode=included запрещён в commercial-v1",
        lineId: input.id,
      });
    }

    let purchaseUnitExVat: Decimal | null = null;
    let purchaseInputVatTotal: Decimal | null = null;
    let purchaseQty: Decimal | null = null;

    const hasPurchasePrice =
      input.purchase?.unitPrice != null && input.purchase.unitPrice !== "";

    if (hasPurchasePrice && input.purchase) {
      const raw = d(input.purchase.unitPrice!);
      const norm = normalizeToExVat(
        raw,
        input.purchase.vatMode,
        input.purchase.vatRate,
      );
      if (norm.issue) lineIssues.push({ ...norm.issue, lineId: input.id });
      purchaseUnitExVat = norm.exVat;
      purchaseQty = computePurchaseQty(qty, input.purchase, input.purchaseQtyOverride);
      if (norm.exVat != null && norm.inputVatPerUnit != null) {
        purchaseInputVatTotal = norm.inputVatPerUnit.mul(purchaseQty);
      }
    } else {
      purchaseQty = computePurchaseQty(qty, input.purchase, input.purchaseQtyOverride);
    }

    // Determine unit sale ex VAT
    let unitSaleExVat: Decimal | null = null;
    const priceType = input.priceType ?? "fixed";
    const forcedUnknown =
      input.forceUnknown ||
      priceType === "on_request" ||
      (priceType === "from" && sale?.unitPriceExVat == null) ||
      (priceType === "range" && sale?.unitPriceExVat == null);

    if (sale?.unitPriceExVat != null && sale.unitPriceExVat !== "") {
      unitSaleExVat = d(sale.unitPriceExVat);
    } else if (sale?.markupPercent != null || sale?.targetMarginPercent != null) {
      let costBase: Decimal | null =
        sale.costBaseExVat != null && sale.costBaseExVat !== ""
          ? d(sale.costBaseExVat)
          : null;
      if (
        costBase == null &&
        purchaseUnitExVat != null &&
        purchaseQty != null &&
        qty.gt(0)
      ) {
        costBase = purchaseUnitExVat.mul(purchaseQty).div(qty);
      }
      if (costBase == null) {
        lineIssues.push({
          code: "cost_base_unknown",
          message: "Нет базы затрат для наценки/маржи",
          lineId: input.id,
        });
      } else if (sale.markupPercent != null) {
        unitSaleExVat = costBase.mul(d(1).plus(d(sale.markupPercent).div(100)));
      } else if (sale.targetMarginPercent != null) {
        const g = d(sale.targetMarginPercent);
        if (g.gte(100)) {
          throw new CalcValidationError([
            {
              code: "margin_ge_100",
              message: "Целевая маржа должна быть < 100%",
              lineId: input.id,
            },
          ]);
        }
        unitSaleExVat = costBase.div(d(1).minus(g.div(100)));
      }
    } else if (purchaseUnitExVat != null && !forcedUnknown) {
      // 1:1 resale of purchase unit ex-VAT (commercial preview default)
      unitSaleExVat = purchaseUnitExVat;
    }

    if (forcedUnknown && (sale?.unitPriceExVat == null || sale.unitPriceExVat === "")) {
      unitSaleExVat = null;
    }

    // known for totals if we have unit sale
    const hasSale = unitSaleExVat != null;

    let lineGross: Decimal | null = null;
    let lineDiscount: Decimal | null = null;
    let afterLineDiscount: Decimal | null = null;

    if (hasSale && unitSaleExVat) {
      const unitRounded = round2(unitSaleExVat);
      unitSaleExVat = unitRounded;
      lineGross = unitRounded.mul(qty);
      let discount = d(0);
      if (input.lineDiscountAmount != null && input.lineDiscountAmount !== "") {
        discount = d(input.lineDiscountAmount);
      } else if (input.lineDiscountPercent != null && input.lineDiscountPercent !== "") {
        discount = lineGross.mul(d(input.lineDiscountPercent)).div(100);
      }
      if (discount.gt(lineGross)) {
        throw new CalcValidationError([
          {
            code: "line_discount_too_large",
            message: "Скидка строки больше суммы строки",
            lineId: input.id,
          },
        ]);
      }
      afterLineDiscount = round2(lineGross.minus(discount));
      lineDiscount = round2(discount);
      if (afterLineDiscount.lt(0)) {
        throw new CalcValidationError([
          {
            code: "negative_line",
            message: "Отрицательная сумма строки запрещена",
            lineId: input.id,
          },
        ]);
      }
    }

    return {
      input,
      known: hasSale && afterLineDiscount != null,
      qty,
      purchaseQty,
      purchaseUnitExVat,
      purchaseInputVatTotal,
      unitSaleExVat,
      lineGross,
      lineDiscount,
      afterLineDiscount,
      globalAlloc: d(0),
      lineNet: afterLineDiscount,
      outputVat: null,
      outputVatMode: sale?.vatMode ?? null,
      lineIssues,
    };
  });

  // Global discount
  if (globalDiscount) {
    const amount = d(globalDiscount.amount);
    if (amount.lt(0)) {
      throw new CalcValidationError([
        { code: "negative_global_discount", message: "Общая скидка не может быть отрицательной" },
      ]);
    }
    const bases = working
      .filter(
        (w) =>
          w.known &&
          w.afterLineDiscount != null &&
          globalDiscount.lineIds.includes(w.input.id),
      )
      .map((w) => ({ id: w.input.id, amount: w.afterLineDiscount! }));

    try {
      const alloc = allocateGlobalDiscount(amount, bases);
      for (const w of working) {
        const a = alloc.get(w.input.id);
        if (a) {
          w.globalAlloc = a;
          w.lineNet = w.afterLineDiscount!.minus(a);
          if (w.lineNet.lt(0)) {
            throw new CalcValidationError([
              {
                code: "negative_line_after_global",
                message: "Строка стала отрицательной после общей скидки",
                lineId: w.input.id,
              },
            ]);
          }
          w.lineNet = round2(w.lineNet);
        }
      }
    } catch (e) {
      if (e && typeof e === "object" && "code" in e) {
        const err = e as { code: string; message?: string };
        throw new CalcValidationError([
          {
            code: String(err.code),
            message: err.message ?? String(err.code),
          },
        ]);
      }
      throw e;
    }
  }

  // Output VAT on lines
  let taxComplete = true;
  for (const w of working) {
    issues.push(...w.lineIssues);
    if (!w.known || w.lineNet == null) continue;
    const mode = w.input.sale?.vatMode ?? "not_specified";
    w.outputVatMode = mode;
    const { vat, issues: vatIssues } = outputVatFor(
      w.lineNet,
      mode,
      w.input.sale?.vatRate,
      w.input.id,
      "line",
    );
    issues.push(...vatIssues);
    w.outputVat = vat;
    if (vat == null) taxComplete = false;
  }

  // Adjustments
  const adjResults: CalcAdjustmentResult[] = [];
  const sortedAdj = [...adjustments].sort((a, b) => a.applyOrder - b.applyOrder);
  for (const adj of sortedAdj) {
    let amountExVat: Decimal;
    if (adj.type === "amount") {
      amountExVat = round2(d(adj.value));
    } else {
      const base = working
        .filter((w) => w.known && w.lineNet != null && adj.baseLineIds.includes(w.input.id))
        .reduce((s, w) => s.plus(w.lineNet!), d(0));
      amountExVat = round2(base.mul(d(adj.value)).div(100));
    }
    const { vat, issues: vatIssues } = outputVatFor(
      amountExVat,
      adj.vatMode,
      adj.vatRate,
      adj.id,
      "adjustment",
    );
    issues.push(...vatIssues);
    if (vat == null) taxComplete = false;
    adjResults.push({
      id: adj.id,
      name: adj.name,
      amountExVat: money(amountExVat),
      outputVat: vat != null ? money(vat) : null,
      vatMode: adj.vatMode,
      costType: adj.costType ?? "other",
    });
  }

  const knownLines = working.filter((w) => w.known && w.lineNet != null);
  const unknownLineCount = working.length - knownLines.length;

  const linesExVat = knownLines.reduce((s, w) => s.plus(w.lineNet!), d(0));
  const adjustmentsExVat = adjResults.reduce((s, a) => s.plus(d(a.amountExVat)), d(0));
  const outputVatTotal = knownLines
    .reduce((s, w) => (w.outputVat != null ? s.plus(w.outputVat) : s), d(0))
    .plus(
      adjResults.reduce(
        (s, a) => (a.outputVat != null ? s.plus(d(a.outputVat)) : s),
        d(0),
      ),
    );

  const knownSubtotal = round2(linesExVat.plus(adjustmentsExVat).plus(outputVatTotal));
  const isComplete = unknownLineCount === 0 && taxComplete;

  const breakdownByCostType: Record<string, string> = {};
  for (const w of knownLines) {
    const key = w.input.costType;
    breakdownByCostType[key] = money(
      d(breakdownByCostType[key] ?? "0").plus(w.lineNet!),
    );
  }
  for (const a of adjResults) {
    const key = a.costType;
    breakdownByCostType[key] = money(
      d(breakdownByCostType[key] ?? "0").plus(d(a.amountExVat)),
    );
  }

  const breakdownByVatMode: Record<string, string> = {};
  for (const w of knownLines) {
    const key = w.outputVatMode ?? "unknown";
    breakdownByVatMode[key] = money(
      d(breakdownByVatMode[key] ?? "0").plus(w.lineNet!),
    );
  }

  // Internal
  let purchaseCostExVat: Decimal | null = d(0);
  let inputVatTotal: Decimal | null = d(0);
  let purchaseKnown = true;
  for (const w of working) {
    if (w.purchaseUnitExVat != null && w.purchaseQty != null) {
      purchaseCostExVat = purchaseCostExVat.plus(
        w.purchaseUnitExVat.mul(w.purchaseQty),
      );
      if (w.purchaseInputVatTotal != null) {
        inputVatTotal = inputVatTotal.plus(w.purchaseInputVatTotal);
      }
    } else if (w.input.purchase?.unitPrice) {
      purchaseKnown = false;
    }
  }
  if (!purchaseKnown) {
    purchaseCostExVat = null;
    inputVatTotal = null;
  }

  const notes: string[] = [
    "Показатель contribution — до налогов на прибыль; не чистая прибыль.",
    "Ставки НДС в расчёте синтетические/заданные пользователем.",
  ];

  let contribution: string | null = null;
  let profitabilityStatus: CalcResult["internal"]["profitabilityStatus"] = "unavailable";

  if (purchaseCostExVat != null && recoverable !== "unknown") {
    let costSide = purchaseCostExVat;
    if (recoverable === "false" && inputVatTotal != null) {
      costSide = costSide.plus(inputVatTotal);
      notes.push("Входной НДС включён в затраты (невозмещаемый).");
    } else if (recoverable === "true") {
      notes.push("Входной НДС считается возмещаемым и не включён в costSide.");
    }
    const contrib = linesExVat.minus(costSide);
    contribution = money(contrib);
    profitabilityStatus = contrib.lt(0) ? "negative" : "ok";
  } else {
    notes.push("Доходность недоступна: неизвестна возмещаемость входного НДС или закупка.");
  }

  const lineResults: CalcLineResult[] = working.map((w) => ({
    id: w.input.id,
    costType: w.input.costType,
    qty: w.qty.toFixed(),
    unit: w.input.unit,
    known: w.known,
    purchaseQty: w.purchaseQty?.toFixed() ?? null,
    purchaseUnitExVat: w.purchaseUnitExVat ? w.purchaseUnitExVat.toFixed(6) : null,
    purchaseInputVat: w.purchaseInputVatTotal ? money(round2(w.purchaseInputVatTotal)) : null,
    unitSaleExVat: w.unitSaleExVat ? money(w.unitSaleExVat) : null,
    lineGrossExVat: w.lineGross ? money(round2(w.lineGross)) : null,
    lineDiscountExVat: w.lineDiscount ? money(w.lineDiscount) : null,
    afterLineDiscountExVat: w.afterLineDiscount ? money(w.afterLineDiscount) : null,
    globalDiscountAllocated: money(w.globalAlloc),
    lineNetExVat: w.lineNet ? money(w.lineNet) : null,
    outputVat: w.outputVat != null ? money(w.outputVat) : null,
    outputVatMode: w.outputVatMode,
    assumptionNote: w.input.assumptionNote ?? null,
    issues: w.lineIssues,
  }));

  return {
    calculationPolicyVersion: CALCULATION_POLICY_VERSION,
    currency,
    complete: isComplete,
    unknownLineCount,
    linesExVat: money(round2(linesExVat)),
    adjustmentsExVat: money(round2(adjustmentsExVat)),
    outputVatTotal: money(round2(outputVatTotal)),
    grandTotal: isComplete ? money(knownSubtotal) : null,
    knownSubtotal: money(knownSubtotal),
    lines: lineResults,
    adjustments: adjResults,
    breakdownByCostType,
    breakdownByVatMode,
    internal: {
      purchaseCostExVat: purchaseCostExVat ? money(round2(purchaseCostExVat)) : null,
      inputVatTotal: inputVatTotal ? money(round2(inputVatTotal)) : null,
      inputVatRecoverable: recoverable,
      contributionBeforeProfitTax: contribution,
      profitabilityStatus,
      notes,
    },
    issues,
    blockedForFixedVersion: !isComplete || unknownLineCount > 0,
  };
}
