import { prisma } from "@/lib/db";
import { ELEKTRIK24, ETL_XXI, type CuratedRow } from "./curated-data";
import { fingerprint } from "./http";
import type { ListingLifecycle, Prisma } from "@prisma/client";
import { invalidateCache } from "@/modules/cache/invalidate";
import { cacheTags } from "@/modules/cache/tags";

const PARSER_VERSION = "curated-manual-v1";

const EXTRA_UNITS: { code: string; nameRu: string; dimension?: string }[] = [
  { code: "point", nameRu: "точка", dimension: "count" },
  { code: "visit", nameRu: "выезд", dimension: "count" },
  { code: "contour", nameRu: "контур", dimension: "count" },
  { code: "cable_line", nameRu: "кабельная линия", dimension: "count" },
  { code: "hour", nameRu: "час", dimension: "time" },
  { code: "m2", nameRu: "м²", dimension: "area" },
];

async function ensureUnits() {
  for (const u of EXTRA_UNITS) {
    await prisma.unit.upsert({
      where: { code: u.code },
      create: { code: u.code, nameRu: u.nameRu, dimension: u.dimension },
      update: { nameRu: u.nameRu },
    });
  }
}

function rowToPrices(row: CuratedRow) {
  if (row.priceType === "on_request") {
    return { priceType: "on_request" as const, price: null, priceMin: null, priceMax: null };
  }
  if (row.priceType === "from") {
    return {
      priceType: "from" as const,
      price: null,
      priceMin: row.priceMin ?? null,
      priceMax: null,
    };
  }
  if (row.priceType === "range") {
    return {
      priceType: "range" as const,
      price: null,
      priceMin: row.priceMin ?? null,
      priceMax: row.priceMax ?? null,
    };
  }
  return {
    priceType: "fixed" as const,
    price: row.price ?? null,
    priceMin: null,
    priceMax: null,
  };
}

export async function publishCuratedPublicSources(opts?: {
  actorUserId?: string | null;
}) {
  const locked = await prisma.$queryRaw<Array<{ ok: boolean }>>`
    SELECT pg_try_advisory_lock(hashtext('quathub:publish-curated')) AS ok
  `;
  if (!locked[0]?.ok) {
    throw new Error("Публикация источников уже выполняется на другом экземпляре");
  }
  try {
    return await publishCuratedPublicSourcesInner(opts);
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext('quathub:publish-curated'))`;
  }
}

async function publishCuratedPublicSourcesInner(opts?: {
  actorUserId?: string | null;
}) {
  await ensureUnits();
  const almaty = await prisma.city.findFirst({ where: { code: "almaty" } });
  const units = await prisma.unit.findMany();
  const unitByCode = new Map(units.map((u) => [u.code, u]));

  const serviceCat = await prisma.category.upsert({
    where: { slug: "public-etl" },
    create: {
      slug: "public-etl",
      nameRu: "Электролаборатория (публичные прайсы)",
      kind: "service",
      isNavigable: true,
      sortOrder: 90,
    },
    update: { isNavigable: true, nameRu: "Электролаборатория (публичные прайсы)" },
  });
  const montageCat = await prisma.category.upsert({
    where: { slug: "public-montage" },
    create: {
      slug: "public-montage",
      nameRu: "Электромонтаж (публичные прайсы)",
      kind: "service",
      isNavigable: true,
      sortOrder: 91,
    },
    update: { isNavigable: true, nameRu: "Электромонтаж (публичные прайсы)" },
  });

  const packs = [
    { meta: ETL_XXI, categoryId: serviceCat.id },
    { meta: ELEKTRIK24, categoryId: montageCat.id },
  ];

  let added = 0;
  let changed = 0;

  for (const pack of packs) {
    const provider = await prisma.sourceProvider.upsert({
      where: { code: pack.meta.code },
      create: {
        code: pack.meta.code,
        name: pack.meta.name,
        domain: pack.meta.domain,
        websiteUrl: pack.meta.websiteUrl,
        regionNote: pack.meta.regionNote,
        notes:
          "Публичный прайс. QuatHub не является партнёром и не подтверждал наличие/окончательную стоимость.",
        autoSync: false,
      },
      update: {
        name: pack.meta.name,
        websiteUrl: pack.meta.websiteUrl,
        regionNote: pack.meta.regionNote,
      },
    });

    const run = await prisma.sourceImportRun.create({
      data: {
        sourceProviderId: provider.id,
        status: "running",
        parserVersion: PARSER_VERSION,
      },
    });

    const existingKeys = new Set(
      (
        await prisma.publicPriceListing.findMany({
          where: { sourceProviderId: provider.id },
          select: { sourceRecordKey: true },
        })
      ).map((r) => r.sourceRecordKey),
    );

    let runAdded = 0;
    let runChanged = 0;

    for (const row of pack.meta.rows as CuratedRow[]) {
      const unit = unitByCode.get(row.unitCode) ?? unitByCode.get("pcs");
      if (!unit) continue;
      const prices = rowToPrices(row);
      const sku = `PUB-${pack.meta.code}-${row.key}`.toUpperCase().slice(0, 60);
      const item = await prisma.catalogItem.upsert({
        where: { sku },
        create: {
          kind: "service",
          categoryId: pack.categoryId,
          name: row.name,
          sku,
          baseUnitId: unit.id,
          description:
            "Публичная позиция из внешнего прайса. Не предложение зарегистрированного поставщика QuatHub.",
          serviceScope: {
            requiresSurvey: Boolean(row.requiresInspection),
            note: row.note ?? null,
          },
          status: "active",
          isDemo: false,
        },
        update: {
          name: row.name,
          status: "active",
        },
      });

      const hash = fingerprint({
        name: row.name,
        unit: row.unitCode,
        priceType: prices.priceType,
        price: prices.price,
        priceMin: prices.priceMin,
        priceMax: prices.priceMax,
        tax: row.taxStatus,
      });

      const data: Prisma.PublicPriceListingUncheckedCreateInput = {
        sourceProviderId: provider.id,
        catalogItemId: item.id,
        sourceKind: pack.meta.sourceKind,
        verificationStatus: pack.meta.verificationStatus,
        lifecycle: "published",
        sourceUrl: pack.meta.sourceUrl,
        sourceDomain: pack.meta.domain,
        sourcePublishedAt: new Date(pack.meta.sourcePublishedAt),
        fetchedAt: new Date(),
        lastCheckedAt: new Date(),
        parserVersion: PARSER_VERSION,
        sourceRecordKey: row.key,
        sourceContentHash: hash,
        priceType: prices.priceType,
        price: prices.price,
        priceMin: prices.priceMin,
        priceMax: prices.priceMax,
        currency: "KZT",
        taxStatus: row.taxStatus,
        unitCode: row.unitCode,
        unitLabelRaw: row.unitLabelRaw,
        regionCode: "almaty",
        cityName: almaty?.nameRu ?? "Алматы",
        requiresInspection: Boolean(row.requiresInspection),
        isMarketOrientator: false,
        provenance: {
          method: "manual_curated_from_public_page",
          checkedBy: opts?.actorUserId ?? "system",
          sourceTitle: pack.meta.name,
        },
      };

      const prev = await prisma.publicPriceListing.findUnique({
        where: {
          sourceProviderId_sourceRecordKey: {
            sourceProviderId: provider.id,
            sourceRecordKey: row.key,
          },
        },
      });
      if (!prev) {
        await prisma.publicPriceListing.create({ data });
        runAdded++;
        added++;
      } else if (prev.sourceContentHash !== hash) {
        await prisma.publicPriceListing.update({
          where: { id: prev.id },
          data: { ...data, id: undefined },
        });
        runChanged++;
        changed++;
      } else {
        await prisma.publicPriceListing.update({
          where: { id: prev.id },
          data: {
            lastCheckedAt: new Date(),
            lifecycle: "published",
          },
        });
      }
      existingKeys.delete(row.key);
    }

    // Missing keys → stale (do not delete)
    let removed = 0;
    for (const key of existingKeys) {
      await prisma.publicPriceListing.updateMany({
        where: { sourceProviderId: provider.id, sourceRecordKey: key },
        data: { lifecycle: "stale" satisfies ListingLifecycle },
      });
      removed++;
    }

    await prisma.sourceImportRun.update({
      where: { id: run.id },
      data: {
        status: "published",
        finishedAt: new Date(),
        addedCount: runAdded,
        changedCount: runChanged,
        removedCount: removed,
        report: { rows: pack.meta.rows.length, parserVersion: PARSER_VERSION },
      },
    });
  }

  const version = await prisma.catalogDataVersion.create({
    data: {
      label: `public-prices-${new Date().toISOString().slice(0, 10)}`,
      notes: "Curated ETL XXI + Elektrik24 public prices",
      meta: { added, changed, parserVersion: PARSER_VERSION },
    },
  });

  await invalidateCache(
    {
      tags: [cacheTags.catalog, cacheTags.sitemap],
      paths: ["/catalog/services", "/catalog/products", "/app/admin/sources"],
    },
    "background",
  );

  return { added, changed, versionId: version.id };
}

export { parsePublicPriceLabel } from "./http";
export function evaluatePublishGate(opts: {
  previousCount: number;
  nextCount: number;
  maxDropRatio?: number;
  priceChangeRatio?: number;
}): { publish: boolean; reason?: string } {
  const maxDrop = opts.maxDropRatio ?? 0.2;
  if (opts.previousCount > 0 && opts.nextCount < opts.previousCount * (1 - maxDrop)) {
    return {
      publish: false,
      reason: `Row count dropped more than ${maxDrop * 100}%`,
    };
  }
  if (opts.priceChangeRatio != null && opts.priceChangeRatio > 0.5) {
    return { publish: false, reason: "Price changed more than 50%" };
  }
  return { publish: true };
}
