import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { addCatalogItemToDraft } from "@/modules/estimates/draft";
import { issueEstimateVersion } from "@/modules/estimates/versions";
import {
  acceptResponseIntoDraft,
  previewRequestsFromVersion,
  respondToRequest,
  submitProcurementRequests,
  toSupplierRequestDto,
  getSupplierRequest,
} from "@/modules/requests/service";
import { updateOwnOffer } from "@/modules/offers/service";
import { AccessDeniedError } from "@/lib/permissions";
import {
  setNotificationAdapter,
  type NotificationPayload,
} from "@/modules/notifications/port";

const prisma = new PrismaClient();

describe("procurement requests flow", () => {
  let buyerId: string;
  let supplier1UserId: string;
  let supplier2UserId: string;
  let supplier1OrgId: string;
  let supplier2OrgId: string;
  let versionId: string;
  let estimateId: string;
  let projectId: string;
  let line1Id: string;
  let line2Id: string;
  let notifications: NotificationPayload[] = [];

  beforeAll(async () => {
    notifications = [];
    setNotificationAdapter({
      async send(payload) {
        notifications.push(payload);
        return { ok: true };
      },
    });

    await prisma.procurementRequest.deleteMany({
      where: {
        OR: [
          { buyerOrganization: { name: "[TEST] Req Buyer" } },
          { supplierOrganization: { name: { in: ["[TEST] Req S1", "[TEST] Req S2"] } } },
        ],
      },
    });
    await prisma.project.deleteMany({ where: { name: "[TEST] Req Project" } });
    await prisma.offer.deleteMany({
      where: {
        supplier: { name: { in: ["[TEST] Req S1", "[TEST] Req S2"] } },
      },
    });
    await prisma.membership.deleteMany({
      where: {
        user: {
          email: {
            in: [
              "test-req-buyer@quathub.local",
              "test-req-s1@quathub.local",
              "test-req-s2@quathub.local",
            ],
          },
        },
      },
    });
    await prisma.userSession.deleteMany({
      where: {
        user: {
          email: {
            in: [
              "test-req-buyer@quathub.local",
              "test-req-s1@quathub.local",
              "test-req-s2@quathub.local",
            ],
          },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            "test-req-buyer@quathub.local",
            "test-req-s1@quathub.local",
            "test-req-s2@quathub.local",
          ],
        },
      },
    });
    await prisma.organization.deleteMany({
      where: {
        name: { in: ["[TEST] Req Buyer", "[TEST] Req S1", "[TEST] Req S2"] },
      },
    });

    const passwordHash = await hash("Test1234!", 10);
    const buyerOrg = await prisma.organization.create({
      data: { name: "[TEST] Req Buyer", type: "buyer", isDemo: true },
    });
    const s1 = await prisma.organization.create({
      data: { name: "[TEST] Req S1", type: "supplier", isDemo: true },
    });
    const s2 = await prisma.organization.create({
      data: { name: "[TEST] Req S2", type: "supplier", isDemo: true },
    });
    supplier1OrgId = s1.id;
    supplier2OrgId = s2.id;

    const buyer = await prisma.user.create({
      data: {
        email: "test-req-buyer@quathub.local",
        passwordHash,
        memberships: { create: { organizationId: buyerOrg.id, role: "estimator" } },
        activeOrgSessions: { create: { activeOrganizationId: buyerOrg.id } },
      },
    });
    const u1 = await prisma.user.create({
      data: {
        email: "test-req-s1@quathub.local",
        passwordHash,
        memberships: {
          create: { organizationId: s1.id, role: "supplier_manager" },
        },
        activeOrgSessions: { create: { activeOrganizationId: s1.id } },
      },
    });
    const u2 = await prisma.user.create({
      data: {
        email: "test-req-s2@quathub.local",
        passwordHash,
        memberships: {
          create: { organizationId: s2.id, role: "supplier_manager" },
        },
        activeOrgSessions: { create: { activeOrganizationId: s2.id } },
      },
    });
    buyerId = buyer.id;
    supplier1UserId = u1.id;
    supplier2UserId = u2.id;

    const project = await prisma.project.create({
      data: { organizationId: buyerOrg.id, name: "[TEST] Req Project" },
    });
    projectId = project.id;

    const p1 = await prisma.catalogItem.findFirstOrThrow({
      where: { kind: "product", status: "active" },
    });
    const p2 = await prisma.catalogItem.findFirstOrThrow({
      where: {
        kind: "product",
        status: "active",
        id: { not: p1.id },
      },
    });

    // Create offers owned by test suppliers for these items
    const offer1 = await prisma.offer.create({
      data: {
        supplierOrganizationId: s1.id,
        catalogItemId: p1.id,
        priceType: "fixed",
        price: "1000",
        currency: "KZT",
        inputVatMode: "excluded",
        inputVatRate: "12",
        availability: "in_stock",
        moderationStatus: "approved",
        supplierSku: `TEST-S1-${p1.id.slice(0, 6)}`,
        isDemo: true,
      },
    });
    const offer2 = await prisma.offer.create({
      data: {
        supplierOrganizationId: s2.id,
        catalogItemId: p2.id,
        priceType: "fixed",
        price: "2000",
        currency: "KZT",
        inputVatMode: "excluded",
        inputVatRate: "12",
        availability: "in_stock",
        moderationStatus: "approved",
        supplierSku: `TEST-S2-${p2.id.slice(0, 6)}`,
        isDemo: true,
      },
    });

    const a = await addCatalogItemToDraft({
      userId: buyerId,
      projectId,
      catalogItemId: p1.id,
      offerId: offer1.id,
      qty: "5",
    });
    estimateId = a.estimateId;
    const b = await addCatalogItemToDraft({
      userId: buyerId,
      projectId,
      catalogItemId: p2.id,
      offerId: offer2.id,
      qty: "3",
    });

    const est = await prisma.estimate.findUniqueOrThrow({
      where: { id: estimateId },
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
    line1Id = est.lines.find((l) => l.offerId === offer1.id)!.id;
    line2Id = est.lines.find((l) => l.offerId === offer2.id)!.id;
    // second add may have refreshed - reload
    const est2 = await prisma.estimate.findUniqueOrThrow({
      where: { id: b.estimateId },
      include: { lines: true },
    });
    line1Id = est2.lines.find((l) => l.supplierOrganizationId === s1.id)!.id;
    line2Id = est2.lines.find((l) => l.supplierOrganizationId === s2.id)!.id;

    const issued = await issueEstimateVersion({
      userId: buyerId,
      estimateId: b.estimateId,
      expectedRevision: est2.draftRevision,
      allowPreliminary: true,
    });
    versionId = issued.version.id;
  });

  it("previews two supplier groups", async () => {
    const preview = await previewRequestsFromVersion(buyerId, versionId);
    expect(preview.groups.length).toBeGreaterThanOrEqual(2);
  });

  it("creates two isolated requests and is idempotent", async () => {
    const key = `test-batch-${versionId}`;
    const first = await submitProcurementRequests({
      userId: buyerId,
      versionId,
      idempotencyKey: key,
      assignments: [
        { supplierOrganizationId: supplier1OrgId, estimateLineIds: [line1Id] },
        { supplierOrganizationId: supplier2OrgId, estimateLineIds: [line2Id] },
      ],
    });
    expect(first.requests).toHaveLength(2);
    expect(first.duplicated).toBe(false);
    expect(notifications.length).toBeGreaterThanOrEqual(2);

    const second = await submitProcurementRequests({
      userId: buyerId,
      versionId,
      idempotencyKey: key,
      assignments: [
        { supplierOrganizationId: supplier1OrgId, estimateLineIds: [line1Id] },
        { supplierOrganizationId: supplier2OrgId, estimateLineIds: [line2Id] },
      ],
    });
    expect(second.duplicated).toBe(true);
    expect(second.requests).toHaveLength(2);

    const s1reqs = await prisma.procurementRequest.findMany({
      where: { supplierOrganizationId: supplier1OrgId, estimateVersionId: versionId },
      include: { lines: true },
    });
    expect(s1reqs).toHaveLength(1);
    expect(s1reqs[0].lines).toHaveLength(1);
    expect(s1reqs[0].notificationStatus).toBe("delivered");
  });

  it("supplier cannot see other supplier lines or sale economics", async () => {
    const req = await prisma.procurementRequest.findFirstOrThrow({
      where: { supplierOrganizationId: supplier1OrgId, estimateVersionId: versionId },
    });
    const full = await getSupplierRequest(supplier1UserId, req.id);
    const dto = toSupplierRequestDto(full);
    const json = JSON.stringify(dto);
    expect(json).not.toContain("unitSalePrice");
    expect(json).not.toContain("markup");
    expect(dto.lines).toHaveLength(1);

    await expect(getSupplierRequest(supplier2UserId, req.id)).rejects.toBeInstanceOf(
      Error,
    );
  });

  it("response does not change issued version; accept updates draft", async () => {
    const req = await prisma.procurementRequest.findFirstOrThrow({
      where: { supplierOrganizationId: supplier1OrgId, estimateVersionId: versionId },
    });
    const versionBefore = await prisma.estimateVersion.findUniqueOrThrow({
      where: { id: versionId },
    });
    const calcBefore = JSON.stringify(versionBefore.calcResult);

    await respondToRequest({
      userId: supplier1UserId,
      requestId: req.id,
      proposedPrice: "1500",
      proposedLeadTimeDays: 7,
      proposedAvailability: "in_stock",
      message: "Подтверждаем",
    });

    const versionAfter = await prisma.estimateVersion.findUniqueOrThrow({
      where: { id: versionId },
    });
    expect(JSON.stringify(versionAfter.calcResult)).toBe(calcBefore);

    const accepted = await acceptResponseIntoDraft({
      userId: buyerId,
      requestId: req.id,
      responseVersion: 1,
    });
    expect(accepted.issuedVersionId).toBe(versionId);

    const draftLine = await prisma.estimateLine.findFirstOrThrow({
      where: { id: line1Id },
    });
    expect(draftLine.unitPurchasePrice?.toString()).toBe("1500");
    expect(draftLine.confirmationStatus).toBe("confirmed");

    const still = await prisma.estimateVersion.findUniqueOrThrow({
      where: { id: versionId },
    });
    expect(JSON.stringify(still.calcResult)).toBe(calcBefore);
  });

  it("forbids editing another supplier offer", async () => {
    const foreign = await prisma.offer.findFirstOrThrow({
      where: { supplierOrganizationId: supplier2OrgId },
    });
    await expect(
      updateOwnOffer({
        userId: supplier1UserId,
        offerId: foreign.id,
        data: { price: "1" },
      }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });
});
