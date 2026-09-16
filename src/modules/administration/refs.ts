import { prisma } from "@/lib/db";
import {
  requireAuthContext,
  requirePlatformAdmin,
} from "@/modules/organizations/access";
import { writeAudit } from "./audit";
import type { CatalogItemKind } from "@prisma/client";

export async function listCategoriesAdmin(userId: string) {
  await requirePlatformAdmin(userId);
  return prisma.category.findMany({
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
    include: { _count: { select: { items: true } } },
  });
}

export async function upsertCategory(
  userId: string,
  data: {
    id?: string;
    slug: string;
    nameRu: string;
    nameKk?: string | null;
    kind: CatalogItemKind;
    isNavigable?: boolean;
    sortOrder?: number;
    parentId?: string | null;
  },
) {
  await requirePlatformAdmin(userId);
  if (data.id) {
    const before = await prisma.category.findUnique({ where: { id: data.id } });
    const after = await prisma.category.update({
      where: { id: data.id },
      data: {
        slug: data.slug,
        nameRu: data.nameRu,
        nameKk: data.nameKk,
        kind: data.kind,
        isNavigable: data.isNavigable,
        sortOrder: data.sortOrder,
        parentId: data.parentId,
      },
    });
    await writeAudit({
      actorUserId: userId,
      entityType: "Category",
      entityId: after.id,
      action: "update",
      before,
      after,
    });
    return after;
  }
  const after = await prisma.category.create({
    data: {
      slug: data.slug,
      nameRu: data.nameRu,
      nameKk: data.nameKk,
      kind: data.kind,
      isNavigable: data.isNavigable ?? true,
      sortOrder: data.sortOrder ?? 0,
      parentId: data.parentId,
    },
  });
  await writeAudit({
    actorUserId: userId,
    entityType: "Category",
    entityId: after.id,
    action: "create",
    after,
  });
  return after;
}

export async function listUnitsAdmin(userId: string) {
  await requirePlatformAdmin(userId);
  return prisma.unit.findMany({ orderBy: { code: "asc" } });
}

export async function upsertUnit(
  userId: string,
  data: {
    id?: string;
    code: string;
    nameRu: string;
    nameKk?: string | null;
    dimension?: string | null;
  },
) {
  await requirePlatformAdmin(userId);
  if (data.id) {
    const before = await prisma.unit.findUnique({ where: { id: data.id } });
    const after = await prisma.unit.update({
      where: { id: data.id },
      data: {
        code: data.code,
        nameRu: data.nameRu,
        nameKk: data.nameKk,
        dimension: data.dimension,
      },
    });
    await writeAudit({
      actorUserId: userId,
      entityType: "Unit",
      entityId: after.id,
      action: "update",
      before,
      after,
    });
    return after;
  }
  const after = await prisma.unit.create({
    data: {
      code: data.code,
      nameRu: data.nameRu,
      nameKk: data.nameKk,
      dimension: data.dimension,
    },
  });
  await writeAudit({
    actorUserId: userId,
    entityType: "Unit",
    entityId: after.id,
    action: "create",
    after,
  });
  return after;
}

export async function listRegionsAdmin(userId: string) {
  await requirePlatformAdmin(userId);
  return prisma.region.findMany({
    include: { cities: { orderBy: { nameRu: "asc" } } },
    orderBy: { nameRu: "asc" },
  });
}

export async function listAttributeDefinitions(userId: string) {
  await requirePlatformAdmin(userId);
  return prisma.attributeDefinition.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function listTemplatesAdmin(userId: string) {
  await requirePlatformAdmin(userId);
  return prisma.estimateTemplate.findMany({ orderBy: { code: "asc" } });
}

export async function updateTemplate(
  userId: string,
  id: string,
  data: { nameRu?: string; description?: string | null },
) {
  await requirePlatformAdmin(userId);
  const before = await prisma.estimateTemplate.findUnique({ where: { id } });
  const after = await prisma.estimateTemplate.update({
    where: { id },
    data: { nameRu: data.nameRu, description: data.description },
  });
  await writeAudit({
    actorUserId: userId,
    organizationId: after.organizationId,
    entityType: "EstimateTemplate",
    entityId: after.id,
    action: "update",
    before,
    after,
  });
  return after;
}

/** For pages that only need platform admin gate. */
export async function assertAdmin(userId: string) {
  await requirePlatformAdmin(userId);
}

export async function assertOfferManager(userId: string) {
  return requireAuthContext(userId, "offer:manage");
}
