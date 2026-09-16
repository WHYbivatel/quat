import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import {
  addCatalogItemToDraft,
  getEstimateWorkspace,
} from "@/modules/estimates/draft";

const prisma = new PrismaClient();

describe("unified draft estimate", () => {
  let userId: string;
  let projectId: string;
  let productId: string;
  let serviceId: string;
  let offerId: string;

  beforeAll(async () => {
    await prisma.project.deleteMany({ where: { name: "[TEST] Unified draft" } });
    await prisma.membership.deleteMany({
      where: { user: { email: "test-draft@quathub.local" } },
    });
    await prisma.userSession.deleteMany({
      where: { user: { email: "test-draft@quathub.local" } },
    });
    await prisma.user.deleteMany({ where: { email: "test-draft@quathub.local" } });
    await prisma.organization.deleteMany({ where: { name: "[TEST] Draft Org" } });

    const org = await prisma.organization.create({
      data: { name: "[TEST] Draft Org", type: "buyer", isDemo: true },
    });
    const passwordHash = await hash("Test1234!", 10);
    const user = await prisma.user.create({
      data: {
        email: "test-draft@quathub.local",
        passwordHash,
        memberships: { create: { organizationId: org.id, role: "estimator" } },
        activeOrgSessions: { create: { activeOrganizationId: org.id } },
      },
    });
    userId = user.id;
    const project = await prisma.project.create({
      data: { organizationId: org.id, name: "[TEST] Unified draft" },
    });
    projectId = project.id;

    const product = await prisma.catalogItem.findFirst({
      where: { kind: "product", status: "active" },
    });
    const service = await prisma.catalogItem.findFirst({
      where: { kind: "service", status: "active" },
    });
    expect(product && service).toBeTruthy();
    productId = product!.id;
    serviceId = service!.id;
    const offer = await prisma.offer.findFirst({
      where: { catalogItemId: productId, priceType: "fixed", moderationStatus: "approved" },
    });
    offerId = offer!.id;
  });

  it("adds product and service into the same draft estimate", async () => {
    const a = await addCatalogItemToDraft({
      userId,
      projectId,
      catalogItemId: productId,
      offerId,
      qty: "12.5",
    });
    const b = await addCatalogItemToDraft({
      userId,
      projectId,
      catalogItemId: serviceId,
      qty: "12.5",
    });
    expect(a.estimateId).toBe(b.estimateId);

    const estimate = await getEstimateWorkspace(userId, a.estimateId);
    expect(estimate.lines.length).toBeGreaterThanOrEqual(2);
    expect(estimate.lines.some((l) => l.catalogItemId === productId)).toBe(true);
    expect(estimate.lines.some((l) => l.catalogItemId === serviceId)).toBe(true);
    expect(estimate.lines.some((l) => l.qty.toString() === "12.5")).toBe(true);
  });
});
