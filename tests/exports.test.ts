import { describe, expect, it, beforeAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { addCatalogItemToDraft } from "@/modules/estimates/draft";
import { issueEstimateVersion } from "@/modules/estimates/versions";
import { buildExportModel, canonicalTotals } from "@/modules/exports/model";
import { renderCsv } from "@/modules/exports/csv";
import { renderDocx } from "@/modules/exports/docx";
import { renderXlsx } from "@/modules/exports/xlsx";
import { renderPdf, buildPdfHtml } from "@/modules/exports/pdf";
import { sanitizeSpreadsheetText } from "@/modules/exports/sanitize";
import type { EstimateSnapshot } from "@/modules/estimates/versions";
import type { CalcResult } from "@/modules/pricing";
import { exportVersionDocument } from "@/modules/exports/service";
import { NotFoundError } from "@/lib/permissions";

const prisma = new PrismaClient();

function makeSnapshot(lineCount: number, opts?: { longName?: boolean; kk?: boolean }): {
  snapshot: EstimateSnapshot;
  calc: CalcResult;
} {
  const lines: Array<Record<string, unknown>> = Array.from({ length: lineCount }, (_, i) => {
    const name = opts?.longName
      ? `Очень длинное название позиции для проверки переносов ${"АБВГДӘІҢҒҮҰҚӨҺ".repeat(4)} #${i + 1}`
      : opts?.kk
        ? `Кабель / кабель өткізгіш №${i + 1}`
        : `Позиция ${i + 1}`;
    return {
      id: `L${i}`,
      sectionId: "S1",
      nameSnapshot: name,
      unitSnapshot: "pcs",
      qty: "1.5",
      unitSalePrice: "100.00",
      unitPurchasePrice: "80.00",
      purchaseVatMode: "excluded",
      saleVatMode: i % 2 === 0 ? "zero" : "excluded",
      saleVatRate: i % 2 === 0 ? "0" : "12",
      discountPercent: null,
      discountAmount: null,
      costType: "material",
      priceType: "fixed",
      markupPercent: "10",
      notesInternal: "secret-note",
      unknownPriceReason: null,
      supplierNameSnapshot: "Demo",
    };
  });

  // one unknown
  if (lineCount > 0) {
    lines.push({
      id: "UNK",
      sectionId: "S1",
      nameSnapshot: "Испытания по запросу",
      unitSnapshot: "set",
      qty: "1",
      unitSalePrice: null,
      unitPurchasePrice: null,
      purchaseVatMode: "not_specified",
      saleVatMode: "not_specified",
      saleVatRate: null,
      discountPercent: null,
      discountAmount: null,
      costType: "labor",
      priceType: "on_request",
      markupPercent: null,
      notesInternal: null,
      unknownPriceReason: "Цена по запросу",
      supplierNameSnapshot: null,
    });
  }

  const known = lines.filter((l) => l.id !== "UNK");
  const linesExVat = (known.length * 1.5 * 100).toFixed(2);
  // VAT only on odd indices with excluded 12%: roughly half
  let vat = 0;
  known.forEach((l, i) => {
    if (i % 2 === 1) vat += 1.5 * 100 * 0.12;
  });
  const outputVatTotal = vat.toFixed(2);
  const knownSubtotal = (Number(linesExVat) + Number(outputVatTotal)).toFixed(2);

  const calc: CalcResult = {
    calculationPolicyVersion: "commercial-v1",
    currency: "KZT",
    complete: false,
    unknownLineCount: 1,
    linesExVat,
    adjustmentsExVat: "0.00",
    outputVatTotal,
    grandTotal: null,
    knownSubtotal,
    lines: lines.map((l) => ({
      id: String(l.id),
      costType: l.costType as "material",
      qty: String(l.qty),
      unit: String(l.unitSnapshot),
      known: l.id !== "UNK",
      purchaseQty: null,
      purchaseUnitExVat: null,
      purchaseInputVat: null,
      unitSaleExVat: l.unitSalePrice != null ? String(l.unitSalePrice) : null,
      lineGrossExVat: l.id === "UNK" ? null : (1.5 * 100).toFixed(2),
      lineDiscountExVat: "0.00",
      afterLineDiscountExVat: l.id === "UNK" ? null : (1.5 * 100).toFixed(2),
      globalDiscountAllocated: "0.00",
      lineNetExVat: l.id === "UNK" ? null : (1.5 * 100).toFixed(2),
      outputVat:
        l.id === "UNK"
          ? null
          : Number(l.saleVatRate) > 0
            ? (1.5 * 100 * 0.12).toFixed(2)
            : "0.00",
      outputVatMode: (l.saleVatMode as "zero") ?? "zero",
      assumptionNote: null,
      issues: [],
    })),
    adjustments: [],
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
    blockedForFixedVersion: true,
  };

  const snapshot: EstimateSnapshot = {
    estimate: {
      id: "E1",
      number: "СМ-001",
      title: "Тестовая смета ӘІҢ",
      currency: "KZT",
      terms: "=HYPERLINK(\"http://evil\")",
      exclusions: null,
      offerValidUntil: null,
      proposalStatus: "prepared",
      calculationPolicyVersion: "commercial-v1",
    },
    project: {
      id: "P1",
      name: "Проект",
      objectName: "Объект",
      objectAddress: null,
      clientName: "Клиент",
      cityName: "Алматы",
      assumptions: null,
      description: null,
      timezone: "Asia/Almaty",
    },
    sections: [{ id: "S1", title: "Материалы", sortOrder: 0 }],
    lines,
    adjustments: [],
    issuedAt: new Date().toISOString(),
  };

  return { snapshot, calc };
}

describe("export sanitization", () => {
  it("guards formula injection", () => {
    expect(sanitizeSpreadsheetText("=CMD()")).toBe("'=CMD()");
    expect(sanitizeSpreadsheetText("+123")).toBe("'+123");
    expect(sanitizeSpreadsheetText("-1+1")).toBe("'-1+1");
    expect(sanitizeSpreadsheetText("@sum")).toBe("'@sum");
    expect(sanitizeSpreadsheetText("обычный текст")).toBe("обычный текст");
  });
});

describe("export cross-format totals", () => {
  it("matches totals for 1, 50, 300 lines across csv/xlsx/docx and pdf html", async () => {
    for (const n of [1, 50, 300]) {
      const { snapshot, calc } = makeSnapshot(n, {
        longName: n === 50,
        kk: n === 1,
      });
      const model = buildExportModel({
        snapshot,
        calc,
        variant: "client",
        versionNumber: 1,
        preliminary: true,
      });
      const canon = canonicalTotals(model);

      const csvBuf = renderCsv(model);
      expect(csvBuf[0]).toBe(0xef);
      expect(csvBuf[1]).toBe(0xbb);
      expect(csvBuf[2]).toBe(0xbf);
      const csv = csvBuf.toString("utf8");
      expect(csv).toContain(model.totals.knownSubtotal);
      expect(csv).toContain(model.totals.linesExVat);
      const xlsx = await renderXlsx(model);
      expect(xlsx.byteLength).toBeGreaterThan(1000);
      expect(sanitizeSpreadsheetText(snapshot.estimate.terms!)).toMatch(/^'/);

      const docx = await renderDocx(model);
      expect(docx.byteLength).toBeGreaterThan(1000);

      const html = buildPdfHtml(model);
      expect(html).toContain("Известная часть стоимости");
      expect(html).toContain(model.totals.knownSubtotal);
      expect(html).toContain("ӘІҢ");
      // client variant must not leak purchase
      expect(html).not.toContain("secret-note");
      expect(html).not.toContain("80.00");

      const internal = buildExportModel({
        snapshot,
        calc,
        variant: "internal",
        versionNumber: 1,
      });
      expect(canonicalTotals(internal)).toBe(canon);
      expect(internal.internalNote).toContain("ВНУТРЕННИЙ");
      const internalHtml = buildPdfHtml(internal);
      expect(internalHtml).toContain("80.00");
    }
  }, 120_000);

  it("renders real pdf for small document", async () => {
    const { snapshot, calc } = makeSnapshot(3, { kk: true });
    const model = buildExportModel({
      snapshot,
      calc,
      variant: "client",
      versionNumber: 1,
    });
    const pdf = await renderPdf(model);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(500);
  }, 120_000);
});

describe("export access control", () => {
  let userA: string;
  let versionId: string;
  let userB: string;

  beforeAll(async () => {
    await prisma.exportArtifact.deleteMany({
      where: { createdBy: { email: { in: ["test-ex-a@quathub.local", "test-ex-b@quathub.local"] } } },
    });
    await prisma.project.deleteMany({
      where: { name: { in: ["[TEST] Export A", "[TEST] Export B"] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ["test-ex-a@quathub.local", "test-ex-b@quathub.local"] } },
    });
    await prisma.organization.deleteMany({
      where: { name: { in: ["[TEST] Export Org A", "[TEST] Export Org B"] } },
    });

    const passwordHash = await hash("Test1234!", 10);
    const orgA = await prisma.organization.create({
      data: { name: "[TEST] Export Org A", type: "buyer", isDemo: true },
    });
    const orgB = await prisma.organization.create({
      data: { name: "[TEST] Export Org B", type: "buyer", isDemo: true },
    });
    const a = await prisma.user.create({
      data: {
        email: "test-ex-a@quathub.local",
        passwordHash,
        memberships: { create: { organizationId: orgA.id, role: "estimator" } },
        activeOrgSessions: { create: { activeOrganizationId: orgA.id } },
      },
    });
    const b = await prisma.user.create({
      data: {
        email: "test-ex-b@quathub.local",
        passwordHash,
        memberships: { create: { organizationId: orgB.id, role: "estimator" } },
        activeOrgSessions: { create: { activeOrganizationId: orgB.id } },
      },
    });
    userA = a.id;
    userB = b.id;

    const project = await prisma.project.create({
      data: { organizationId: orgA.id, name: "[TEST] Export A" },
    });
    const product = await prisma.catalogItem.findFirstOrThrow({
      where: { kind: "product", status: "active" },
    });
    const offer = await prisma.offer.findFirstOrThrow({
      where: { catalogItemId: product.id, priceType: "fixed" },
    });
    const added = await addCatalogItemToDraft({
      userId: userA,
      projectId: project.id,
      catalogItemId: product.id,
      offerId: offer.id,
      qty: "2",
    });
    await prisma.estimateLine.updateMany({
      where: { estimateId: added.estimateId },
      data: {
        saleVatMode: "zero",
        saleVatRate: "0",
        unknownPriceReason: null,
      },
    });
    const est = await prisma.estimate.findUniqueOrThrow({
      where: { id: added.estimateId },
    });
    const issued = await issueEstimateVersion({
      userId: userA,
      estimateId: est.id,
      expectedRevision: est.draftRevision,
      allowPreliminary: true,
    });
    versionId = issued.version.id;
  });

  it("owner can export; other org cannot", async () => {
    const ok = await exportVersionDocument({
      userId: userA,
      versionId,
      format: "csv",
      variant: "client",
    });
    expect(ok.buffer.byteLength).toBeGreaterThan(10);
    expect(ok.canonicalTotals).toContain("|");

    await expect(
      exportVersionDocument({
        userId: userB,
        versionId,
        format: "csv",
        variant: "client",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
