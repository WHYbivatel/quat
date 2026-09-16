import { prisma } from "@/lib/db";
import {
  AccessDeniedError,
  NotFoundError,
  can,
  type Action,
} from "@/lib/permissions";
import type { Membership, MembershipRole, Organization } from "@prisma/client";

export type AuthContext = {
  userId: string;
  organizationId: string;
  role: MembershipRole;
  membership: Membership;
  organization: Organization;
};

export async function listMemberships(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getOrCreateActiveOrganizationId(
  userId: string,
): Promise<string | null> {
  const session = await prisma.userSession.findUnique({ where: { userId } });
  if (session?.activeOrganizationId) {
    const stillMember = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: session.activeOrganizationId,
        },
      },
    });
    if (stillMember) return session.activeOrganizationId;
  }

  const first = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (!first) return null;

  await prisma.userSession.upsert({
    where: { userId },
    create: { userId, activeOrganizationId: first.organizationId },
    update: { activeOrganizationId: first.organizationId },
  });
  return first.organizationId;
}

export async function setActiveOrganization(
  userId: string,
  organizationId: string,
): Promise<void> {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!membership) {
    throw new AccessDeniedError("Not a member of organization");
  }
  await prisma.userSession.upsert({
    where: { userId },
    create: { userId, activeOrganizationId: organizationId },
    update: { activeOrganizationId: organizationId },
  });
}

export async function requireAuthContext(
  userId: string,
  action?: Action,
  organizationId?: string,
): Promise<AuthContext> {
  const activeId =
    organizationId ?? (await getOrCreateActiveOrganizationId(userId));
  if (!activeId) {
    throw new AccessDeniedError("No active organization");
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId, organizationId: activeId },
    },
    include: { organization: true },
  });

  if (!membership || membership.organization.status !== "active") {
    throw new AccessDeniedError("Organization access denied");
  }

  if (action && !can(membership.role, action)) {
    throw new AccessDeniedError(
      `Недостаточно прав (${action}) для роли ${membership.role} в организации «${membership.organization.name}»`,
    );
  }

  return {
    userId,
    organizationId: activeId,
    role: membership.role,
    membership,
    organization: membership.organization,
  };
}

export async function requirePlatformAdmin(userId: string): Promise<void> {
  const adminMembership = await prisma.membership.findFirst({
    where: { userId, role: "platform_admin" },
  });
  if (!adminMembership) {
    throw new AccessDeniedError("Platform admin required");
  }
}

export { AccessDeniedError, NotFoundError };
