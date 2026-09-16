import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/modules/organizations/access";
import { NotFoundError } from "@/lib/permissions";
import { writeAudit } from "./audit";
import type { ModerationStatus, Prisma } from "@prisma/client";

export async function listModerationQueue(
  userId: string,
  status: ModerationStatus = "pending",
) {
  await requirePlatformAdmin(userId);
  return prisma.offer.findMany({
    where: { moderationStatus: status },
    include: {
      catalogItem: { include: { baseUnit: true } },
      supplier: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

export async function setOfferModeration(opts: {
  userId: string;
  offerId: string;
  status: "approved" | "rejected" | "pending";
}) {
  await requirePlatformAdmin(opts.userId);
  const before = await prisma.offer.findUnique({ where: { id: opts.offerId } });
  if (!before) throw new NotFoundError("Offer not found");
  const after = await prisma.offer.update({
    where: { id: opts.offerId },
    data: { moderationStatus: opts.status },
  });
  await writeAudit({
    actorUserId: opts.userId,
    organizationId: after.supplierOrganizationId,
    entityType: "Offer",
    entityId: after.id,
    action: `moderation_${opts.status}`,
    before: { moderationStatus: before.moderationStatus },
    after: { moderationStatus: after.moderationStatus },
  });
  return after;
}

export type OfferAdminFilter = "stale" | "no_price" | "all";

export async function listOffersAdmin(
  userId: string,
  filter: OfferAdminFilter = "all",
) {
  await requirePlatformAdmin(userId);
  const now = new Date();
  let where: Prisma.OfferWhereInput = {};
  if (filter === "stale") {
    where = { validUntil: { lt: now } };
  } else if (filter === "no_price") {
    where = { OR: [{ price: null }, { priceType: "on_request" }] };
  }

  return prisma.offer.findMany({
    where,
    include: {
      catalogItem: true,
      supplier: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

export function isOfferStale(validUntil: Date | null, now = new Date()) {
  return validUntil != null && validUntil.getTime() < now.getTime();
}
