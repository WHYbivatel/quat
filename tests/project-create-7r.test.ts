import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import {
  AccessDeniedError,
  createProjectForUser,
} from "@/modules/projects/service";

const prisma = new PrismaClient();

describe("project create permissions (7R)", () => {
  let buyerId: string;
  let supplierId: string;
  let buyerOrgId: string;

  beforeAll(async () => {
    await prisma.project.deleteMany({
      where: { name: { startsWith: "[TEST] 7R" } },
    });
    await prisma.membership.deleteMany({
      where: {
        user: {
          email: { in: ["test-7r-buyer@quathub.local", "test-7r-sup@quathub.local"] },
        },
      },
    });
    await prisma.userSession.deleteMany({
      where: {
        user: {
          email: { in: ["test-7r-buyer@quathub.local", "test-7r-sup@quathub.local"] },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: { in: ["test-7r-buyer@quathub.local", "test-7r-sup@quathub.local"] },
      },
    });
    await prisma.organization.deleteMany({
      where: { name: { in: ["[TEST] 7R Buyer", "[TEST] 7R Supplier"] } },
    });

    const passwordHash = await hash("Test1234!", 10);
    const buyerOrg = await prisma.organization.create({
      data: { name: "[TEST] 7R Buyer", type: "buyer", isDemo: true },
    });
    const supplierOrg = await prisma.organization.create({
      data: { name: "[TEST] 7R Supplier", type: "supplier", isDemo: true },
    });
    buyerOrgId = buyerOrg.id;

    const buyer = await prisma.user.create({
      data: {
        email: "test-7r-buyer@quathub.local",
        passwordHash,
        memberships: { create: { organizationId: buyerOrg.id, role: "estimator" } },
        activeOrgSessions: { create: { activeOrganizationId: buyerOrg.id } },
      },
    });
    const supplier = await prisma.user.create({
      data: {
        email: "test-7r-sup@quathub.local",
        passwordHash,
        memberships: {
          create: { organizationId: supplierOrg.id, role: "supplier_manager" },
        },
        activeOrgSessions: { create: { activeOrganizationId: supplierOrg.id } },
      },
    });
    buyerId = buyer.id;
    supplierId = supplier.id;
  });

  it("buyer can create project; double idempotency key does not duplicate", async () => {
    const key = "idem-7r-1";
    const a = await createProjectForUser(buyerId, {
      name: "[TEST] 7R Project A",
      idempotencyKey: key,
    });
    const b = await createProjectForUser(buyerId, {
      name: "[TEST] 7R Project A",
      idempotencyKey: key,
    });
    expect(a.id).toBe(b.id);
    expect(a.organizationId).toBe(buyerOrgId);
  });

  it("supplier_manager cannot create project (friendly AccessDenied)", async () => {
    await expect(
      createProjectForUser(supplierId, { name: "[TEST] 7R Forbidden" }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("rejects foreign organizationId", async () => {
    const foreign = await prisma.organization.create({
      data: { name: "[TEST] 7R Foreign", type: "buyer", isDemo: true },
    });
    await expect(
      createProjectForUser(buyerId, {
        name: "[TEST] 7R Hijack",
        organizationId: foreign.id,
      }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await prisma.organization.delete({ where: { id: foreign.id } });
  });
});
