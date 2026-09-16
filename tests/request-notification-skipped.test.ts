import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { addCatalogItemToDraft } from "@/modules/estimates/draft";
import { issueEstimateVersion } from "@/modules/estimates/versions";
import { submitProcurementRequests } from "@/modules/requests/service";
import { setNotificationAdapter } from "@/modules/notifications/port";

const prisma = new PrismaClient();

describe("request notification skipped without cabinet", () => {
  let buyerId: string;
  let versionId: string;
  let externalOrgId: string;
  let lineId: string;

  beforeAll(async () => {
    setNotificationAdapter({
      async send() {
        throw new Error("should not notify external without cabinet");
      },
    });

    await prisma.procurementRequest.deleteMany({
      where: { buyerOrganization: { name: "[TEST] Ext Buyer" } },
    });
    await prisma.project.deleteMany({ where: { name: "[TEST] Ext Project" } });
    await prisma.membership.deleteMany({
      where: { user: { email: "test-ext-buyer@quathub.local" } },
    });
    await prisma.userSession.deleteMany({
      where: { user: { email: "test-ext-buyer@quathub.local" } },
    });
    await prisma.user.deleteMany({
      where: { email: "test-ext-buyer@quathub.local" },
    });
    await prisma.offer.deleteMany({
      where: { supplier: { name: "[TEST] Ext NoCabinet" } },
    });
    await prisma.organization.deleteMany({
      where: { name: { in: ["[TEST] Ext Buyer", "[TEST] Ext NoCabinet"] } },
    });

    const passwordHash = await hash("Test1234!", 10);
    const buyerOrg = await prisma.organization.create({
      data: { name: "[TEST] Ext Buyer", type: "buyer", isDemo: true },
    });
    const external = await prisma.organization.create({
      data: { name: "[TEST] Ext NoCabinet", type: "supplier", isDemo: true },
    });
    externalOrgId = external.id;

    const buyer = await prisma.user.create({
      data: {
        email: "test-ext-buyer@quathub.local",
        passwordHash,
        memberships: {
          create: { organizationId: buyerOrg.id, role: "estimator" },
        },
        activeOrgSessions: { create: { activeOrganizationId: buyerOrg.id } },
      },
    });
    buyerId = buyer.id;

    const project = await prisma.project.create({
      data: { organizationId: buyerOrg.id, name: "[TEST] Ext Project" },
    });
    const item = await prisma.catalogItem.findFirstOrThrow({
      where: { kind: "product", status: "active" },
    });
    const offer = await prisma.offer.create({
      data: {
        supplierOrganizationId: external.id,
        catalogItemId: item.id,
        priceType: "fixed",
        price: "1111",
        currency: "KZT",
        inputVatMode: "excluded",
        inputVatRate: "12",
        availability: "in_stock",
        moderationStatus: "approved",
        supplierSku: `EXT-${item.id.slice(0, 6)}`,
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
      include: { lines: true },
    });
    for (const line of est.lines) {
      await prisma.estimateLine.update({
        where: { id: line.id },
        data: {
          saleVatMode: "zero",
          saleVatRate: "0",
          unknownPriceReason: null,
        },
      });
    }
    lineId = est.lines[0]!.id;

    const est2 = await prisma.estimate.findUniqueOrThrow({
      where: { id: added.estimateId },
    });
    const issued = await issueEstimateVersion({
      userId: buyerId,
      estimateId: added.estimateId,
      expectedRevision: est2.draftRevision,
      allowPreliminary: true,
    });
    versionId = issued.version.id;
  });

  it("marks notificationStatus skipped when supplier has no users", async () => {
    const { requests } = await submitProcurementRequests({
      userId: buyerId,
      versionId,
      assignments: [
        {
          supplierOrganizationId: externalOrgId,
          estimateLineIds: [lineId],
        },
      ],
      idempotencyKey: `ext-skip-${Date.now()}`,
    });
    const fresh = await prisma.procurementRequest.findUniqueOrThrow({
      where: { id: requests[0]!.id },
    });
    expect(fresh.notificationStatus).toBe("skipped");
    expect(fresh.notificationError).toMatch(/нет пользователей кабинета/i);
  });
});
