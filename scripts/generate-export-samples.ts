/**
 * Generate sample export files into .data/samples for manual review.
 * Usage: pnpm exec tsx scripts/generate-export-samples.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildExportModel } from "../src/modules/exports/model";
import { renderCsv } from "../src/modules/exports/csv";
import { renderDocx } from "../src/modules/exports/docx";
import { renderXlsx } from "../src/modules/exports/xlsx";
import { renderPdf } from "../src/modules/exports/pdf";
import type { EstimateSnapshot } from "../src/modules/estimates/versions";
import type { CalcResult } from "../src/modules/pricing";

async function main() {
  const snapshot: EstimateSnapshot = {
    estimate: {
      id: "sample",
      number: "СМ-DEMO",
      title: "Демо-смета ӘІҢ / демо смета",
      currency: "KZT",
      terms: "Учебные цены. Оплата вне платформы.",
      exclusions: "Нормативная ПСД не включена",
      offerValidUntil: null,
      proposalStatus: "prepared",
      calculationPolicyVersion: "commercial-v1",
    },
    project: {
      id: "p",
      name: "Пилот",
      objectName: "Склад",
      objectAddress: null,
      clientName: "ТОО Демо",
      cityName: "Алматы",
      assumptions: "Учебный пример",
      description: null,
      timezone: "Asia/Almaty",
    },
    sections: [{ id: "s1", title: "Материалы и работы", sortOrder: 0 }],
    lines: [
      {
        id: "1",
        sectionId: "s1",
        nameSnapshot: "Кабель ВВГнг 3×2.5",
        unitSnapshot: "m",
        qty: "100",
        unitSalePrice: "800",
        unitPurchasePrice: "700",
        saleVatMode: "zero",
        costType: "material",
        priceType: "fixed",
      },
      {
        id: "2",
        sectionId: "s1",
        nameSnapshot: "Прокладка кабеля",
        unitSnapshot: "m",
        qty: "100",
        unitSalePrice: "350",
        saleVatMode: "zero",
        costType: "labor",
        priceType: "fixed",
      },
    ],
    adjustments: [],
    issuedAt: new Date().toISOString(),
  };

  const calc: CalcResult = {
    calculationPolicyVersion: "commercial-v1",
    currency: "KZT",
    complete: true,
    unknownLineCount: 0,
    linesExVat: "115000.00",
    adjustmentsExVat: "5000.00",
    outputVatTotal: "0.00",
    grandTotal: "120000.00",
    knownSubtotal: "120000.00",
    lines: [
      {
        id: "1",
        costType: "material",
        qty: "100",
        unit: "m",
        known: true,
        purchaseQty: null,
        purchaseUnitExVat: null,
        purchaseInputVat: null,
        unitSaleExVat: "800.00",
        lineGrossExVat: "80000.00",
        lineDiscountExVat: "0.00",
        afterLineDiscountExVat: "80000.00",
        globalDiscountAllocated: "0.00",
        lineNetExVat: "80000.00",
        outputVat: "0.00",
        outputVatMode: "zero",
        assumptionNote: null,
        issues: [],
      },
      {
        id: "2",
        costType: "labor",
        qty: "100",
        unit: "m",
        known: true,
        purchaseQty: null,
        purchaseUnitExVat: null,
        purchaseInputVat: null,
        unitSaleExVat: "350.00",
        lineGrossExVat: "35000.00",
        lineDiscountExVat: "0.00",
        afterLineDiscountExVat: "35000.00",
        globalDiscountAllocated: "0.00",
        lineNetExVat: "35000.00",
        outputVat: "0.00",
        outputVatMode: "zero",
        assumptionNote: null,
        issues: [],
      },
    ],
    adjustments: [
      {
        id: "d",
        name: "Доставка",
        amountExVat: "5000.00",
        outputVat: "0.00",
        vatMode: "zero",
        costType: "logistics",
      },
    ],
    breakdownByCostType: {},
    breakdownByVatMode: {},
    internal: {
      purchaseCostExVat: null,
      inputVatTotal: null,
      inputVatRecoverable: "unknown",
      contributionBeforeProfitTax: null,
      profitabilityStatus: "unavailable",
      notes: [],
    },
    issues: [],
    blockedForFixedVersion: false,
  };

  const model = buildExportModel({
    snapshot,
    calc,
    variant: "client",
    versionNumber: 1,
    preliminary: false,
    composerName: "Demo",
  });

  const dir = path.join(process.cwd(), ".data", "samples");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "sample.csv"), renderCsv(model));
  await writeFile(path.join(dir, "sample.xlsx"), await renderXlsx(model));
  await writeFile(path.join(dir, "sample.docx"), await renderDocx(model));
  await writeFile(path.join(dir, "sample.pdf"), await renderPdf(model));
  console.log(`Samples written to ${dir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
