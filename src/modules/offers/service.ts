import type {
  AvailabilityStatus,
  ModerationStatus,
  PriceType,
  VatMode,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/modules/organizations/access";
import { AccessDeniedError, NotFoundError } from "@/lib/permissions";

export async function listOwnOffers(userId: string) {
  const ctx = await requireAuthContext(userId, "offer:manage");
  return prisma.offer.findMany({
    where: { supplierOrganizationId: ctx.organizationId },
    include: {
      catalogItem: { include: { baseUnit: true, category: true } },
      cities: { include: { city: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function updateOwnOffer(opts: {
  userId: string;
  offerId: string;
  data: {
    priceType?: PriceType;
    price?: string | null;
    priceMin?: string | null;
    priceMax?: string | null;
    inputVatMode?: VatMode;
    inputVatRate?: string | null;
    unknownPriceReason?: string | null;
    availability?: AvailabilityStatus;
    moq?: string | null;
    packQty?: string | null;
    leadTimeDays?: number | null;
    validUntil?: string | null;
    moderationStatus?: ModerationStatus;
  };
}) {
  const ctx = await requireAuthContext(opts.userId, "offer:manage");
  const offer = await prisma.offer.findUnique({ where: { id: opts.offerId } });
  if (!offer) throw new NotFoundError("Offer not found");
  if (offer.supplierOrganizationId !== ctx.organizationId) {
    throw new AccessDeniedError("Cannot edit another supplier's offer");
  }

  // New/changed public prices go to pending moderation unless already draft
  const moderationStatus =
    opts.data.moderationStatus ??
    (opts.data.price !== undefined || opts.data.priceType !== undefined
      ? "pending"
      : undefined);

  return prisma.offer.update({
    where: { id: offer.id },
    data: {
      priceType: opts.data.priceType,
      price: opts.data.price === undefined ? undefined : opts.data.price,
      priceMin: opts.data.priceMin === undefined ? undefined : opts.data.priceMin,
      priceMax: opts.data.priceMax === undefined ? undefined : opts.data.priceMax,
      inputVatMode: opts.data.inputVatMode,
      inputVatRate:
        opts.data.inputVatRate === undefined ? undefined : opts.data.inputVatRate,
      unknownPriceReason: opts.data.unknownPriceReason,
      availability: opts.data.availability,
      moq: opts.data.moq === undefined ? undefined : opts.data.moq,
      packQty: opts.data.packQty === undefined ? undefined : opts.data.packQty,
      leadTimeDays: opts.data.leadTimeDays,
      validUntil:
        opts.data.validUntil === undefined
          ? undefined
          : opts.data.validUntil
            ? new Date(opts.data.validUntil)
            : null,
      moderationStatus,
    },
  });
}

export async function updateSupplierOrgProfile(opts: {
  userId: string;
  name?: string;
  bin?: string | null;
}) {
  const ctx = await requireAuthContext(opts.userId, "offer:manage");
  return prisma.organization.update({
    where: { id: ctx.organizationId },
    data: {
      name: opts.name,
      bin: opts.bin === undefined ? undefined : opts.bin,
    },
  });
}
