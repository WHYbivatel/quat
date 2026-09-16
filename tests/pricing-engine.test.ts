import { describe, expect, it } from "vitest";
import {
  CalcValidationError,
  calculateCommercialEstimate,
  ceilToPack,
  normalizeToExVat,
  CALCULATION_POLICY_VERSION,
  type CalcLineInput,
  type AdjustmentInput,
} from "@/modules/pricing";
import { d } from "@/lib/decimal";

function line(
  partial: Partial<CalcLineInput> & Pick<CalcLineInput, "id" | "costType" | "qty" | "unit">,
): CalcLineInput {
  return {
    sale: { vatMode: "zero", vatRate: "0" },
    priceType: "fixed",
    ...partial,
  };
}

describe("commercial-v1 control examples", () => {
  it("cable + install + delivery = 120000", () => {
    const lines: CalcLineInput[] = [
      line({
        id: "cable",
        costType: "material",
        qty: "100",
        unit: "m",
        sale: { unitPriceExVat: "800", vatMode: "zero", vatRate: "0" },
      }),
      line({
        id: "install",
        costType: "labor",
        qty: "100",
        unit: "m",
        sale: { unitPriceExVat: "350", vatMode: "zero", vatRate: "0" },
      }),
    ];
    const adjustments: AdjustmentInput[] = [
      {
        id: "delivery",
        name: "Доставка",
        type: "amount",
        value: "5000",
        baseLineIds: [],
        vatMode: "zero",
        vatRate: "0",
        applyOrder: 1,
        costType: "logistics",
      },
    ];
    const result = calculateCommercialEstimate(lines, adjustments);
    expect(result.calculationPolicyVersion).toBe(CALCULATION_POLICY_VERSION);
    expect(result.complete).toBe(true);
    expect(result.grandTotal).toBe("120000.00");
    expect(result.linesExVat).toBe("115000.00");
    expect(result.adjustmentsExVat).toBe("5000.00");
  });

  it("10% discount on cable only → 112000", () => {
    const lines: CalcLineInput[] = [
      line({
        id: "cable",
        costType: "material",
        qty: "100",
        unit: "m",
        sale: { unitPriceExVat: "800", vatMode: "zero", vatRate: "0" },
        lineDiscountPercent: "10",
      }),
      line({
        id: "install",
        costType: "labor",
        qty: "100",
        unit: "m",
        sale: { unitPriceExVat: "350", vatMode: "zero", vatRate: "0" },
      }),
    ];
    const adjustments: AdjustmentInput[] = [
      {
        id: "delivery",
        name: "Доставка",
        type: "amount",
        value: "5000",
        baseLineIds: [],
        vatMode: "zero",
        vatRate: "0",
        applyOrder: 1,
        costType: "logistics",
      },
    ];
    const result = calculateCommercialEstimate(lines, adjustments);
    expect(result.grandTotal).toBe("112000.00");
    expect(result.lines.find((l) => l.id === "cable")?.lineNetExVat).toBe("72000.00");
  });

  it("on_request line keeps known subtotal 112000 incomplete", () => {
    const lines: CalcLineInput[] = [
      line({
        id: "cable",
        costType: "material",
        qty: "100",
        unit: "m",
        sale: { unitPriceExVat: "800", vatMode: "zero", vatRate: "0" },
        lineDiscountPercent: "10",
      }),
      line({
        id: "install",
        costType: "labor",
        qty: "100",
        unit: "m",
        sale: { unitPriceExVat: "350", vatMode: "zero", vatRate: "0" },
      }),
      line({
        id: "tests",
        costType: "labor",
        qty: "1",
        unit: "set",
        priceType: "on_request",
        forceUnknown: true,
        sale: { vatMode: "zero", vatRate: "0" },
      }),
    ];
    const adjustments: AdjustmentInput[] = [
      {
        id: "delivery",
        name: "Доставка",
        type: "amount",
        value: "5000",
        baseLineIds: [],
        vatMode: "zero",
        vatRate: "0",
        applyOrder: 1,
        costType: "logistics",
      },
    ];
    const result = calculateCommercialEstimate(lines, adjustments);
    expect(result.complete).toBe(false);
    expect(result.grandTotal).toBeNull();
    expect(result.knownSubtotal).toBe("112000.00");
    expect(result.unknownLineCount).toBe(1);
    expect(result.blockedForFixedVersion).toBe(true);
  });
});

describe("normalize and pack", () => {
  it("extracts VAT from included price", () => {
    // 112 included with 12% → 100 ex VAT (synthetic rate)
    const { exVat } = normalizeToExVat(d("112"), "included", "12");
    expect(exVat!.toFixed(2)).toBe("100.00");
  });

  it("excluded and zero are distinct modes but same numeric pass-through", () => {
    expect(normalizeToExVat(d("100"), "excluded", "12").exVat!.toFixed()).toBe("100");
    expect(normalizeToExVat(d("100"), "zero", "0").exVat!.toFixed()).toBe("100");
    expect(normalizeToExVat(d("100"), "not_specified", null).exVat).toBeNull();
  });

  it("ceilToPack and MOQ", () => {
    expect(ceilToPack(d("120"), d("100")).toFixed()).toBe("200");
    expect(ceilToPack(d("100"), d("100")).toFixed()).toBe("100");
    expect(ceilToPack(d("50"), null).toFixed()).toBe("50");
  });

  it("purchase qty respects MOQ and pack without changing work qty", () => {
    const result = calculateCommercialEstimate([
      line({
        id: "cable",
        costType: "material",
        qty: "120",
        unit: "m",
        purchase: {
          unitPrice: "800",
          vatMode: "excluded",
          vatRate: "12",
          packQty: "100",
          moq: "100",
        },
        sale: { unitPriceExVat: "800", vatMode: "zero", vatRate: "0" },
      }),
    ]);
    const cable = result.lines[0];
    expect(cable.qty).toBe("120");
    expect(cable.purchaseQty).toBe("200");
    expect(cable.lineNetExVat).toBe("96000.00"); // 120*800 work qty
  });
});

describe("pricing methods", () => {
  it("applies markup on cost base", () => {
    const result = calculateCommercialEstimate([
      line({
        id: "x",
        costType: "material",
        qty: "1",
        unit: "pcs",
        sale: {
          costBaseExVat: "100",
          markupPercent: "25",
          vatMode: "zero",
          vatRate: "0",
        },
      }),
    ]);
    expect(result.lines[0].unitSaleExVat).toBe("125.00");
    expect(result.grandTotal).toBe("125.00");
  });

  it("applies target margin", () => {
    const result = calculateCommercialEstimate([
      line({
        id: "x",
        costType: "material",
        qty: "1",
        unit: "pcs",
        sale: {
          costBaseExVat: "80",
          targetMarginPercent: "20",
          vatMode: "zero",
          vatRate: "0",
        },
      }),
    ]);
    // 80 / 0.8 = 100
    expect(result.lines[0].unitSaleExVat).toBe("100.00");
  });

  it("rejects markup and margin together", () => {
    expect(() =>
      calculateCommercialEstimate([
        line({
          id: "x",
          costType: "material",
          qty: "1",
          unit: "pcs",
          sale: {
            costBaseExVat: "100",
            markupPercent: "10",
            targetMarginPercent: "10",
            vatMode: "zero",
            vatRate: "0",
          },
        }),
      ]),
    ).toThrow(CalcValidationError);
  });
});

describe("discounts and remainder", () => {
  it("rejects line discount larger than base", () => {
    expect(() =>
      calculateCommercialEstimate([
        line({
          id: "x",
          costType: "material",
          qty: "1",
          unit: "pcs",
          sale: { unitPriceExVat: "100", vatMode: "zero", vatRate: "0" },
          lineDiscountAmount: "150",
        }),
      ]),
    ).toThrow(CalcValidationError);
  });

  it("allocates global discount with kopeck remainder deterministically", () => {
    const result = calculateCommercialEstimate(
      [
        line({
          id: "a",
          costType: "material",
          qty: "1",
          unit: "pcs",
          sale: { unitPriceExVat: "10", vatMode: "zero", vatRate: "0" },
        }),
        line({
          id: "b",
          costType: "material",
          qty: "1",
          unit: "pcs",
          sale: { unitPriceExVat: "10", vatMode: "zero", vatRate: "0" },
        }),
        line({
          id: "c",
          costType: "material",
          qty: "1",
          unit: "pcs",
          sale: { unitPriceExVat: "10", vatMode: "zero", vatRate: "0" },
        }),
      ],
      [],
      { amount: "0.10", lineIds: ["a", "b", "c"] },
    );
    const allocated = result.lines.reduce(
      (s, l) => s + Number(l.globalDiscountAllocated),
      0,
    );
    expect(allocated.toFixed(2)).toBe("0.10");
    expect(result.grandTotal).toBe("29.90");
  });
});

describe("VAT mixtures (synthetic rates)", () => {
  it("computes output VAT excluded 12% on lines", () => {
    const result = calculateCommercialEstimate([
      line({
        id: "x",
        costType: "material",
        qty: "1",
        unit: "pcs",
        sale: { unitPriceExVat: "1000", vatMode: "excluded", vatRate: "12" },
      }),
    ]);
    expect(result.outputVatTotal).toBe("120.00");
    expect(result.grandTotal).toBe("1120.00");
  });

  it("keeps input and output VAT separate", () => {
    const result = calculateCommercialEstimate(
      [
        line({
          id: "x",
          costType: "material",
          qty: "1",
          unit: "pcs",
          purchase: {
            unitPrice: "112",
            vatMode: "included",
            vatRate: "12",
          },
          sale: { unitPriceExVat: "150", vatMode: "excluded", vatRate: "12" },
        }),
      ],
      [],
      null,
      { inputVatRecoverable: "true" },
    );
    expect(result.lines[0].purchaseUnitExVat).toBe("100.000000");
    expect(result.outputVatTotal).toBe("18.00");
    expect(result.grandTotal).toBe("168.00");
    // input VAT must not be added again to client total
    expect(Number(result.grandTotal)).toBeLessThan(168 + 12);
  });

  it("mixed zero and excluded", () => {
    const result = calculateCommercialEstimate([
      line({
        id: "a",
        costType: "material",
        qty: "1",
        unit: "pcs",
        sale: { unitPriceExVat: "100", vatMode: "zero", vatRate: "0" },
      }),
      line({
        id: "b",
        costType: "labor",
        qty: "1",
        unit: "pcs",
        sale: { unitPriceExVat: "100", vatMode: "excluded", vatRate: "12" },
      }),
    ]);
    expect(result.outputVatTotal).toBe("12.00");
    expect(result.grandTotal).toBe("212.00");
  });
});

describe("fractions rounding and edge cases", () => {
  it("rounds unit price HALF_UP before qty multiply", () => {
    const result = calculateCommercialEstimate([
      line({
        id: "x",
        costType: "material",
        qty: "3",
        unit: "pcs",
        sale: { unitPriceExVat: "10.005", vatMode: "zero", vatRate: "0" },
      }),
    ]);
    // 10.01 * 3 = 30.03
    expect(result.lines[0].unitSaleExVat).toBe("10.01");
    expect(result.grandTotal).toBe("30.03");
  });

  it("allows zero qty line with zero total", () => {
    const result = calculateCommercialEstimate([
      line({
        id: "x",
        costType: "material",
        qty: "0",
        unit: "pcs",
        sale: { unitPriceExVat: "100", vatMode: "zero", vatRate: "0" },
      }),
    ]);
    expect(result.grandTotal).toBe("0.00");
  });

  it("percent adjustment uses line base after discounts only", () => {
    const result = calculateCommercialEstimate(
      [
        line({
          id: "a",
          costType: "material",
          qty: "1",
          unit: "pcs",
          sale: { unitPriceExVat: "1000", vatMode: "zero", vatRate: "0" },
          lineDiscountPercent: "10",
        }),
      ],
      [
        {
          id: "oh",
          name: "Накладные",
          type: "percent",
          value: "10",
          baseLineIds: ["a"],
          vatMode: "zero",
          vatRate: "0",
          applyOrder: 1,
          costType: "other",
        },
      ],
    );
    // base 900 * 10% = 90; total 990
    expect(result.adjustmentsExVat).toBe("90.00");
    expect(result.grandTotal).toBe("990.00");
  });

  it("negative contribution when sale below cost", () => {
    const result = calculateCommercialEstimate(
      [
        line({
          id: "x",
          costType: "material",
          qty: "1",
          unit: "pcs",
          purchase: { unitPrice: "200", vatMode: "excluded", vatRate: "12" },
          sale: { unitPriceExVat: "100", vatMode: "zero", vatRate: "0" },
        }),
      ],
      [],
      null,
      { inputVatRecoverable: "true" },
    );
    expect(result.internal.profitabilityStatus).toBe("negative");
    expect(result.internal.contributionBeforeProfitTax).toBe("-100.00");
  });

  it("profitability unavailable when recoverable unknown", () => {
    const result = calculateCommercialEstimate(
      [
        line({
          id: "x",
          costType: "material",
          qty: "1",
          unit: "pcs",
          purchase: { unitPrice: "100", vatMode: "excluded", vatRate: "12" },
          sale: { unitPriceExVat: "150", vatMode: "zero", vatRate: "0" },
        }),
      ],
      [],
      null,
      { inputVatRecoverable: "unknown" },
    );
    expect(result.internal.profitabilityStatus).toBe("unavailable");
    expect(result.internal.contributionBeforeProfitTax).toBeNull();
  });
});
