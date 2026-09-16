import { describe, expect, it } from "vitest";
import { evaluatePublishGate } from "@/modules/sources/publish";
import {
  fingerprint,
  parsePublicPriceLabel,
  SsrfBlockedError,
  safeFetchText,
} from "@/modules/sources/http";
import { ELEKTRIK24, ETL_XXI } from "@/modules/sources/curated-data";

describe("public price normalize", () => {
  it("parses fixed / from / range / on_request", () => {
    expect(parsePublicPriceLabel("7 000 ₸")).toMatchObject({
      priceType: "fixed",
      price: "7000",
    });
    expect(parsePublicPriceLabel("от 8000")).toMatchObject({
      priceType: "from",
      priceMin: "8000",
    });
    expect(parsePublicPriceLabel("1000-6000")).toMatchObject({
      priceType: "range",
      priceMin: "1000",
      priceMax: "6000",
    });
    expect(parsePublicPriceLabel("Уточнить цену")).toMatchObject({
      priceType: "on_request",
      price: null,
    });
  });

  it("has enough curated rows", () => {
    expect(ETL_XXI.rows.length).toBeGreaterThanOrEqual(15);
    expect(ELEKTRIK24.rows.length).toBeGreaterThanOrEqual(25);
    expect(ETL_XXI.rows.some((r) => r.priceType === "on_request")).toBe(true);
    expect(ETL_XXI.rows.every((r) => r.taxStatus === "with_vat")).toBe(true);
  });

  it("fingerprint is stable", () => {
    expect(fingerprint({ a: "1", b: "2" })).toBe(fingerprint({ b: "2", a: "1" }));
  });

  it("quarantines sharp row drop", () => {
    const g = evaluatePublishGate({ previousCount: 100, nextCount: 70 });
    expect(g.publish).toBe(false);
  });

  it("blocks SSRF to private hosts", async () => {
    await expect(
      safeFetchText({
        url: "http://127.0.0.1/admin",
        allowlistDomains: ["example.com"],
      }),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });
});
