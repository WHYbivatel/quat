import { prisma } from "@/lib/db";
import {
  AccessDeniedError,
  NotFoundError,
  requireAuthContext,
  listMemberships,
} from "@/modules/organizations/access";
import { can } from "@/lib/permissions";
import type { OrganizationType, Project } from "@prisma/client";

const idemCache = new Map<string, { projectId: string; at: number }>();
const IDEM_TTL_MS = 10 * 60_000;

function takeIdempotent(key: string): string | null {
  const hit = idemCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > IDEM_TTL_MS) {
    idemCache.delete(key);
    return null;
  }
  return hit.projectId;
}

function putIdempotent(key: string, projectId: string) {
  idemCache.set(key, { projectId, at: Date.now() });
}

export async function listProjectsForUser(userId: string): Promise<Project[]> {
  const ctx = await requireAuthContext(userId, "project:read");
  return prisma.project.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getProjectForUser(
  userId: string,
  projectId: string,
): Promise<Project> {
  const ctx = await requireAuthContext(userId, "project:read");
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new NotFoundError("Project not found");
  }
  if (project.organizationId !== ctx.organizationId) {
    throw new NotFoundError("Project not found");
  }
  return project;
}

export async function createProjectForUser(
  userId: string,
  data: {
    name: string;
    cityId?: string;
    objectName?: string;
    description?: string;
    idempotencyKey?: string;
    organizationId?: string;
  },
): Promise<Project> {
  const ctx = await requireAuthContext(
    userId,
    "project:write",
    data.organizationId,
  );

  const name = data.name.trim();
  if (!name) {
    throw new AccessDeniedError("Укажите название проекта");
  }
  if (name.length > 200) {
    throw new AccessDeniedError("Слишком длинное название проекта");
  }

  if (data.cityId) {
    const city = await prisma.city.findUnique({ where: { id: data.cityId } });
    if (!city) throw new AccessDeniedError("Город не найден в справочнике");
  }

  if (data.idempotencyKey) {
    const cacheKey = `${userId}:${ctx.organizationId}:${data.idempotencyKey}`;
    const cachedId = takeIdempotent(cacheKey);
    if (cachedId) {
      const existing = await prisma.project.findUnique({ where: { id: cachedId } });
      if (existing && existing.organizationId === ctx.organizationId) {
        return existing;
      }
    }
  }

  const project = await prisma.project.create({
    data: {
      organizationId: ctx.organizationId,
      name,
      cityId: data.cityId || null,
      objectName: data.objectName,
      description: data.description,
      timezone: ctx.organization.timezone,
    },
  });

  if (data.idempotencyKey) {
    putIdempotent(
      `${userId}:${ctx.organizationId}:${data.idempotencyKey}`,
      project.id,
    );
  }
  return project;
}

/** Create buyer org + owner membership atomically (for users without org). */
export async function createOrganizationForUser(
  userId: string,
  data: { name: string; type?: OrganizationType },
) {
  const memberships = await listMemberships(userId);
  if (memberships.length > 0) {
    throw new AccessDeniedError("У вас уже есть организация");
  }
  const name = data.name.trim();
  if (!name) throw new AccessDeniedError("Укажите название организации");

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name,
        type: data.type ?? "buyer",
        isDemo: true,
      },
    });
    await tx.membership.create({
      data: {
        userId,
        organizationId: org.id,
        role: "owner",
      },
    });
    await tx.userSession.upsert({
      where: { userId },
      create: { userId, activeOrganizationId: org.id },
      update: { activeOrganizationId: org.id },
    });
    return org;
  });
}

export async function userCanCreateProjects(userId: string): Promise<boolean> {
  try {
    const ctx = await requireAuthContext(userId);
    return can(ctx.role, "project:write");
  } catch {
    return false;
  }
}

export { AccessDeniedError, NotFoundError };
