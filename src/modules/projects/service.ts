import { prisma } from "@/lib/db";
import {
  AccessDeniedError,
  NotFoundError,
  requireAuthContext,
} from "@/modules/organizations/access";
import type { Project } from "@prisma/client";

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
    // Do not leak existence across orgs
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
  },
): Promise<Project> {
  const ctx = await requireAuthContext(userId, "project:write");
  return prisma.project.create({
    data: {
      organizationId: ctx.organizationId,
      name: data.name,
      cityId: data.cityId,
      objectName: data.objectName,
      description: data.description,
      timezone: ctx.organization.timezone,
    },
  });
}

export { AccessDeniedError, NotFoundError };
