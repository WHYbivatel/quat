import type { CatalogItemKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type CatalogSearchParams = {
  kind: CatalogItemKind;
  q?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  cityId?: string;
  // attribute filters (codes)
  conductor_material?: string;
  cores?: string;
  cross_section_mm2?: string;
  voltage_v?: string;
  poles?: string;
  rated_current_a?: string;
  trip_curve?: string;
  unit?: string;
};

const PAGE_SIZE = 12;

export async function listNavigableCategories(kind?: CatalogItemKind) {
  return prisma.category.findMany({
    where: {
      isNavigable: true,
      ...(kind ? { kind } : {}),
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getCategoryFilters(categorySlug?: string) {
  if (!categorySlug) return [];
  const category = await prisma.category.findUnique({
    where: { slug: categorySlug },
    include: {
      attributes: {
        where: { isFilterable: true },
        include: { attributeDefinition: { include: { normalizedUnit: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  return category?.attributes.map((a) => a.attributeDefinition) ?? [];
}

function attrFilter(
  code: string,
  raw?: string,
): Prisma.CatalogItemWhereInput | undefined {
  if (!raw) return undefined;
  const num = Number(raw);
  const isNum = raw.trim() !== "" && !Number.isNaN(num);
  return {
    attributes: {
      some: {
        attributeDefinition: { code },
        ...(isNum
          ? { normalizedValue: raw }
          : { value: { equals: raw } }),
      },
    },
  };
}

export async function searchCatalogItems(params: CatalogSearchParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? PAGE_SIZE));
  const q = params.q?.trim();

  const and: Prisma.CatalogItemWhereInput[] = [
    { kind: params.kind, status: "active" },
  ];

  if (params.category) {
    and.push({ category: { slug: params.category, isNavigable: true } });
  } else {
    and.push({ category: { isNavigable: true } });
  }

  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (params.unit) {
    and.push({ baseUnit: { code: params.unit } });
  }

  const attrCodes: (keyof CatalogSearchParams)[] = [
    "conductor_material",
    "cores",
    "cross_section_mm2",
    "voltage_v",
    "poles",
    "rated_current_a",
    "trip_curve",
  ];
  for (const code of attrCodes) {
    const f = attrFilter(code, params[code] as string | undefined);
    if (f) and.push(f);
  }

  if (params.cityId) {
    and.push({
      offers: {
        some: {
          moderationStatus: "approved",
          cities: { some: { cityId: params.cityId } },
        },
      },
    });
  }

  const where: Prisma.CatalogItemWhereInput = { AND: and };

  const [total, items] = await Promise.all([
    prisma.catalogItem.count({ where }),
    prisma.catalogItem.findMany({
      where,
      include: {
        category: true,
        baseUnit: true,
        attributes: { include: { attributeDefinition: true } },
        offers: {
          where: { moderationStatus: "approved" },
          include: {
            supplier: true,
            cities: { include: { city: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
        },
      },
      orderBy: [{ name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    items,
  };
}

export async function getCatalogItemById(id: string) {
  return prisma.catalogItem.findFirst({
    where: { id, status: "active" },
    include: {
      category: true,
      baseUnit: true,
      attributes: {
        include: {
          attributeDefinition: { include: { normalizedUnit: true } },
        },
      },
      offers: {
        where: { moderationStatus: "approved" },
        include: {
          supplier: true,
          cities: { include: { city: true } },
          regions: { include: { region: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
      publicListings: {
        where: { lifecycle: { in: ["published", "stale"] } },
        include: { sourceProvider: true },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
}

export async function getSupplierProfile(organizationId: string) {
  const org = await prisma.organization.findFirst({
    where: {
      id: organizationId,
      type: { in: ["supplier", "contractor", "mixed"] },
      status: "active",
    },
  });
  if (!org) return null;

  const offers = await prisma.offer.findMany({
    where: {
      supplierOrganizationId: organizationId,
      moderationStatus: "approved",
    },
    include: {
      catalogItem: { include: { baseUnit: true, category: true } },
      cities: { include: { city: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return { organization: org, offers };
}

export function serializeOfferPrice(offer: {
  priceType: string;
  price: { toString(): string } | null;
  priceMin: { toString(): string } | null;
  priceMax: { toString(): string } | null;
  currency: string;
  unknownPriceReason: string | null;
  inputVatMode: string;
  inputVatRate: { toString(): string } | null;
  packQty: { toString(): string } | null;
  moq: { toString(): string } | null;
  validUntil: Date | null;
}) {
  const now = new Date();
  const expired = offer.validUntil != null && offer.validUntil < now;

  let label: string;
  switch (offer.priceType) {
    case "on_request":
      label = "Цена по запросу";
      break;
    case "from":
      label = `от ${offer.priceMin?.toString() ?? "—"} ${offer.currency}`;
      break;
    case "range":
      label = `${offer.priceMin?.toString() ?? "—"}–${offer.priceMax?.toString() ?? "—"} ${offer.currency}`;
      break;
    default:
      label =
        offer.price != null
          ? `${offer.price.toString()} ${offer.currency}`
          : "Цена не указана";
  }

  const vatLabel = formatVat(offer.inputVatMode, offer.inputVatRate);

  return {
    label,
    vatLabel,
    expired,
    packQty: offer.packQty?.toString() ?? null,
    moq: offer.moq?.toString() ?? null,
    reason: offer.unknownPriceReason,
    comparableHint:
      "Сравнение без доставки и при разных условиях НДС/упаковки — ориентировочное.",
  };
}

export function serializePublicListing(listing: {
  priceType: string;
  price: { toString(): string } | null;
  priceMin: { toString(): string } | null;
  priceMax: { toString(): string } | null;
  currency: string;
  taxStatus: string;
  unitLabelRaw: string | null;
  cityName: string | null;
  verificationStatus: string;
  lastCheckedAt: Date | null;
  sourceUrl: string | null;
  lifecycle: string;
  isMarketOrientator: boolean;
  requiresInspection: boolean;
  sourceProvider: { name: string };
}) {
  let label: string;
  switch (listing.priceType) {
    case "on_request":
      label = "Цена по запросу";
      break;
    case "from":
      label = `от ${listing.priceMin?.toString() ?? "—"} ${listing.currency}`;
      break;
    case "range":
      label = `${listing.priceMin?.toString() ?? "—"}–${listing.priceMax?.toString() ?? "—"} ${listing.currency}`;
      break;
    default:
      label =
        listing.price != null
          ? `${listing.price.toString()} ${listing.currency}`
          : "Цена не указана";
  }
  const tax =
    listing.taxStatus === "with_vat"
      ? "с НДС (как в источнике)"
      : listing.taxStatus === "without_vat"
        ? "без НДС (как в источнике)"
        : "НДС в источнике не уточнён";
  const trust =
    listing.verificationStatus === "external_unverified" ||
    listing.verificationStatus === "source_checked"
      ? "Публичный прайс; QuatHub не подтверждал наличие и окончательную стоимость"
      : listing.verificationStatus;
  return {
    label,
    tax,
    trust,
    providerName: listing.sourceProvider.name,
    unit: listing.unitLabelRaw,
    city: listing.cityName,
    checkedAt: listing.lastCheckedAt?.toISOString().slice(0, 10) ?? null,
    sourceUrl: listing.sourceUrl,
    stale: listing.lifecycle === "stale",
    marketOnly: listing.isMarketOrientator,
    requiresInspection: listing.requiresInspection,
  };
}

function formatVat(
  mode: string,
  rate: { toString(): string } | null,
): string {
  switch (mode) {
    case "included":
      return rate ? `НДС ${rate.toString()}% включён` : "НДС включён";
    case "excluded":
      return rate ? `без НДС (ставка ${rate.toString()}% — демо)` : "без НДС";
    case "zero":
      return "НДС 0%";
    default:
      return "НДС не указан";
  }
}

/** Normalize fixed/from prices to ex-VAT for rough comparison only. */
export function comparableUnitExVat(offer: {
  priceType: string;
  price: { toString(): string } | null;
  priceMin: { toString(): string } | null;
  inputVatMode: string;
  inputVatRate: { toString(): string } | null;
}): string | null {
  if (offer.priceType === "on_request" || offer.priceType === "range") {
    return null;
  }
  const raw =
    offer.priceType === "from"
      ? offer.priceMin?.toString()
      : offer.price?.toString();
  if (!raw) return null;
  if (offer.inputVatMode === "not_specified") return null;
  if (offer.inputVatMode === "included" && offer.inputVatRate) {
    const rate = Number(offer.inputVatRate.toString());
    if (!Number.isFinite(rate)) return null;
    const ex = Number(raw) / (1 + rate / 100);
    return ex.toFixed(4);
  }
  return Number(raw).toFixed(4);
}
