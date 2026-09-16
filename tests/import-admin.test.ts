import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import {
  buildPreview,
  commitImport,
  createImportJob,
} from "@/modules/administration/import-service";
import { AccessDeniedError } from "@/lib/permissions";
import { issueEstimateVersion } from "@/modules/estimates/versions";
import { addCatalogItemToDraft } from "@/modules/estimates/draft";

const prisma = new PrismaClient();

describe("admin price import", () => {
  let adminId: string;
  let buyerId: string;
  let supplierOrgId: string;
  let versionId: string;
  let versionSnapshotHash: string;

  beforeAll(async () => {
    await prisma.importJob.deleteMany({
      where: { organization: { name: { startsWith: "[TEST] Imp" } } },
    });
    await prisma.organizationVerification.deleteMany({
      where: { organization: { name: { startsWith: "[TEST] Imp" } } },
    });
    await prisma.procurementRequest.deleteMany({
      where: { buyerOrganization: { name: { startsWith: "[TEST] Imp" } } },
    });
    await prisma.project.deleteMany({
      where: { name: { startsWith: "[TEST] Imp" } },
    });
    await prisma.offer.deleteMany({
      where: { supplier: { name: "[TEST] Imp Supplier" } },
    });
    await prisma.membership.deleteMany({
      where: {
        user: {
          email: {
            in: ["test-imp-admin@quathub.local", "test-imp-buyer@quathub.local"],
          },
        },
      },
    });
    await prisma.userSession.deleteMany({
      where: {
        user: {
          email: {
            in: ["test-imp-admin@quathub.local", "test-imp-buyer@quathub.local"],
          },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ["test-imp-admin@quathub.local", "test-imp-buyer@quathub.local"],
        },
      },
    });
    await prisma.organization.deleteMany({
      where: {
        name: { in: ["[TEST] Imp Platform", "[TEST] Imp Supplier", "[TEST] Imp Buyer"] },
      },
    });

    const passwordHash = await hash("Test1234!", 10);
    const platform = await prisma.organization.create({
      data: { name: "[TEST] Imp Platform", type: "mixed", isDemo: true },
    });
    const supplier = await prisma.organization.create({
      data: { name: "[TEST] Imp Supplier", type: "supplier", isDemo: true },
    });
    const buyer = await prisma.organization.create({
      data: { name: "[TEST] Imp Buyer", type: "buyer", isDemo: true },
    });
    supplierOrgId = supplier.id;

    const admin = await prisma.user.create({
      data: {
        email: "test-imp-admin@quathub.local",
        passwordHash,
        memberships: {
          create: { organizationId: platform.id, role: "platform_admin" },
        },
        activeOrgSessions: { create: { activeOrganizationId: platform.id } },
      },
    });
    const buyerUser = await prisma.user.create({
      data: {
        email: "test-imp-buyer@quathub.local",
        passwordHash,
        memberships: {
          create: { organizationId: buyer.id, role: "estimator" },
        },
        activeOrgSessions: { create: { activeOrganizationId: buyer.id } },
      },
    });
    adminId = admin.id;
    buyerId = buyerUser.id;

    // Issue a version to prove snapshots survive import
    const project = await prisma.project.create({
      data: { organizationId: buyer.id, name: "[TEST] Imp Project" },
    });
    const item = await prisma.catalogItem.findFirstOrThrow({
      where: { kind: "product", status: "active" },
    });
    const offer = await prisma.offer.create({
      data: {
        supplierOrganizationId: supplier.id,
        catalogItemId: item.id,
        priceType: "fixed",
        price: "100",
        currency: "KZT",
        inputVatMode: "zero",
        inputVatRate: "0",
        availability: "in_stock",
        moderationStatus: "approved",
        supplierSku: "IMP-BASE",
        isDemo: true,
      },
    });
    const added = await addCatalogItemToDraft({
      userId: buyerId,
      projectId: project.id,
      catalogItemId: item.id,
      offerId: offer.id,
      qty: "1",
    });
    const est = await prisma.estimate.findUniqueOrThrow({
      where: { id: added.estimateId },
    });
    await prisma.estimateLine.updateMany({
      where: { estimateId: est.id },
      data: { saleVatMode: "zero", saleVatRate: "0", unknownPriceReason: null },
    });
    const est2 = await prisma.estimate.findUniqueOrThrow({ where: { id: est.id } });
    const issued = await issueEstimateVersion({
      userId: buyerId,
      estimateId: est.id,
      expectedRevision: est2.draftRevision,
      allowPreliminary: true,
    });
    versionId = issued.version.id;
    versionSnapshotHash = JSON.stringify(issued.version.snapshot);
  });

  function csv(lines: string[]) {
    return Buffer.from(["supplierSku;name;category;unit;priceType;price;catalogSku", ...lines].join("\n"), "utf8");
  }

  it("parses decimal comma, empty price as on_request, rejects bad unit and formula text", async () => {
    const job = await createImportJob({
      userId: adminId,
      organizationId: supplierOrgId,
      fileName: "t1.csv",
      buffer: csv([
        "IMP-A1;Кабель тест;cable;m;fixed;850,50;CBL-VVG-3X2.5",
        "IMP-A2;=CMD|calc;cable;m;fixed;10;",
        "IMP-A3;Пустая цена;cable;m;fixed;;",
        "IMP-A4;Плохая ед;cable;xxx;fixed;10;",
        "IMP-A1;Дубль артикула;cable;m;fixed;11;",
      ]),
    });
    const preview = await buildPreview({ userId: adminId, jobId: job.id });
    const row = (sku: string) =>
      preview.rows.find(
        (r) => r.mapped.supplierSku === sku && r.errors.every((e) => !/Конфликт/i.test(e)),
      ) ?? preview.rows.find((r) => r.mapped.supplierSku === sku);
    expect(row("IMP-A1")?.mapped.price).toBe("850.50");
    expect(row("IMP-A2")?.warnings.some((w) => /формул/i.test(w))).toBe(true);
    expect(row("IMP-A2")?.mapped.name).not.toMatch(/^=/);
    expect(row("IMP-A3")?.mapped.priceType).toBe("on_request");
    expect(row("IMP-A3")?.mapped.price).toBeNull();
    expect(row("IMP-A4")?.errors.some((e) => /единиц/i.test(e))).toBe(true);
    const dup = preview.rows.filter((r) => r.mapped.supplierSku === "IMP-A1");
    expect(dup.some((r) => r.errors.some((e) => /Конфликт/i.test(e)))).toBe(true);
  });

  it("denies import for ordinary buyer", async () => {
    await expect(
      createImportJob({
        userId: buyerId,
        organizationId: supplierOrgId,
        fileName: "x.csv",
        buffer: csv(["X;Y;cable;m;fixed;1;"]),
      }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("re-import updates offer price without changing estimate snapshot", async () => {
    const item = await prisma.catalogItem.findFirstOrThrow({
      where: { sku: "CBL-VVG-3X2.5" },
    });
    const first = await createImportJob({
      userId: adminId,
      organizationId: supplierOrgId,
      fileName: "re1.csv",
      buffer: csv([`IMP-RE;Кабель ВВГнг 3×2.5;cable;m;fixed;900;${item.sku}`]),
    });
    await buildPreview({ userId: adminId, jobId: first.id });
    const r1 = await commitImport({ userId: adminId, jobId: first.id });
    expect(r1.applied).toBeGreaterThanOrEqual(1);

    const offer = await prisma.offer.findFirstOrThrow({
      where: { supplierOrganizationId: supplierOrgId, supplierSku: "IMP-RE" },
    });
    expect(offer.price?.toString()).toBe("900");
    expect(offer.moderationStatus).toBe("pending");

    const second = await createImportJob({
      userId: adminId,
      organizationId: supplierOrgId,
      fileName: "re2.csv",
      buffer: csv([`IMP-RE;Кабель ВВГнг 3×2.5;cable;m;fixed;950;${item.sku}`]),
    });
    await buildPreview({ userId: adminId, jobId: second.id });
    await commitImport({ userId: adminId, jobId: second.id });

    const updated = await prisma.offer.findFirstOrThrow({
      where: { id: offer.id },
    });
    expect(updated.price?.toString()).toBe("950");

    const count = await prisma.offer.count({
      where: { supplierOrganizationId: supplierOrgId, supplierSku: "IMP-RE" },
    });
    expect(count).toBe(1);

    const ver = await prisma.estimateVersion.findUniqueOrThrow({
      where: { id: versionId },
    });
    expect(JSON.stringify(ver.snapshot)).toBe(versionSnapshotHash);
  });
});
