import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import {
  getProjectForUser,
  listProjectsForUser,
  createProjectForUser,
  NotFoundError,
} from "@/modules/projects/service";
import {
  requireAuthContext,
  setActiveOrganization,
  AccessDeniedError,
} from "@/modules/organizations/access";
import { can } from "@/lib/permissions";

const prisma = new PrismaClient();

describe("organization isolation", () => {
  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;
  let projectAId: string;
  let projectBId: string;

  beforeAll(async () => {
    // Use dedicated marker emails; clean previous test rows
    await prisma.procurementRequest.deleteMany({
      where: {
        OR: [
          {
            estimateVersion: {
              estimate: {
                project: {
                  name: {
                    in: ["[TEST] Project A", "[TEST] Project B", "[TEST] Created by A"],
                  },
                },
              },
            },
          },
          { buyerOrganization: { name: { in: ["[TEST] Org A", "[TEST] Org B"] } } },
          { supplierOrganization: { name: { in: ["[TEST] Org A", "[TEST] Org B"] } } },
        ],
      },
    });
    await prisma.project.deleteMany({
      where: {
        name: {
          in: ["[TEST] Project A", "[TEST] Project B", "[TEST] Created by A"],
        },
      },
    });
    await prisma.membership.deleteMany({
      where: {
        user: { email: { in: ["test-a@quathub.local", "test-b@quathub.local"] } },
      },
    });
    await prisma.userSession.deleteMany({
      where: {
        user: { email: { in: ["test-a@quathub.local", "test-b@quathub.local"] } },
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: ["test-a@quathub.local", "test-b@quathub.local"] } },
    });
    await prisma.organization.deleteMany({
      where: { name: { in: ["[TEST] Org A", "[TEST] Org B"] } },
    });

    const passwordHash = await hash("Test1234!", 10);

    const orgA = await prisma.organization.create({
      data: { name: "[TEST] Org A", type: "buyer", isDemo: true },
    });
    const orgB = await prisma.organization.create({
      data: { name: "[TEST] Org B", type: "buyer", isDemo: true },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const userA = await prisma.user.create({
      data: {
        email: "test-a@quathub.local",
        passwordHash,
        name: "Test A",
        memberships: {
          create: { organizationId: orgAId, role: "estimator" },
        },
        activeOrgSessions: {
          create: { activeOrganizationId: orgAId },
        },
      },
    });
    const userB = await prisma.user.create({
      data: {
        email: "test-b@quathub.local",
        passwordHash,
        name: "Test B",
        memberships: {
          create: { organizationId: orgBId, role: "estimator" },
        },
        activeOrgSessions: {
          create: { activeOrganizationId: orgBId },
        },
      },
    });
    userAId = userA.id;
    userBId = userB.id;

    const projectA = await prisma.project.create({
      data: {
        organizationId: orgAId,
        name: "[TEST] Project A",
      },
    });
    const projectB = await prisma.project.create({
      data: {
        organizationId: orgBId,
        name: "[TEST] Project B",
      },
    });
    projectAId = projectA.id;
    projectBId = projectB.id;
  });

  it("lists only projects of active organization", async () => {
    const listA = await listProjectsForUser(userAId);
    expect(listA.every((p) => p.organizationId === orgAId)).toBe(true);
    expect(listA.some((p) => p.id === projectAId)).toBe(true);
    expect(listA.some((p) => p.id === projectBId)).toBe(false);

    const listB = await listProjectsForUser(userBId);
    expect(listB.some((p) => p.id === projectBId)).toBe(true);
    expect(listB.some((p) => p.id === projectAId)).toBe(false);
  });

  it("denies reading foreign project by direct id (as not found)", async () => {
    await expect(getProjectForUser(userAId, projectBId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(getProjectForUser(userBId, projectAId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("allows reading own project by id", async () => {
    const project = await getProjectForUser(userAId, projectAId);
    expect(project.id).toBe(projectAId);
  });

  it("creates project only in active organization", async () => {
    const created = await createProjectForUser(userAId, {
      name: "[TEST] Created by A",
    });
    expect(created.organizationId).toBe(orgAId);
  });

  it("rejects switching to organization without membership", async () => {
    await expect(setActiveOrganization(userAId, orgBId)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
  });

  it("enforces action permissions server-side", async () => {
    expect(can("viewer", "project:write")).toBe(false);
    expect(can("estimator", "project:write")).toBe(true);

    await prisma.membership.updateMany({
      where: { userId: userAId, organizationId: orgAId },
      data: { role: "viewer" },
    });

    await expect(requireAuthContext(userAId, "project:write")).rejects.toBeInstanceOf(
      AccessDeniedError,
    );

    // restore
    await prisma.membership.updateMany({
      where: { userId: userAId, organizationId: orgAId },
      data: { role: "estimator" },
    });
  });
});
