-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('provider_public_price', 'marketplace_aggregate', 'manual_partner_import', 'provider_cabinet');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('external_unverified', 'source_checked', 'provider_claimed', 'provider_verified');

-- CreateEnum
CREATE TYPE "ListingLifecycle" AS ENUM ('staged', 'published', 'quarantined', 'stale', 'archived');

-- CreateEnum
CREATE TYPE "TaxStatus" AS ENUM ('unknown', 'with_vat', 'without_vat', 'not_specified');

-- CreateEnum
CREATE TYPE "SourceImportRunStatus" AS ENUM ('running', 'published', 'quarantined', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "source_providers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "websiteUrl" TEXT,
    "regionNote" TEXT,
    "notes" TEXT,
    "autoSync" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "source_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_price_listings" (
    "id" TEXT NOT NULL,
    "sourceProviderId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "sourceKind" "SourceKind" NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'external_unverified',
    "lifecycle" "ListingLifecycle" NOT NULL DEFAULT 'staged',
    "sourceUrl" TEXT,
    "sourceDomain" TEXT,
    "sourcePublishedAt" TIMESTAMPTZ(3),
    "fetchedAt" TIMESTAMPTZ(3),
    "lastCheckedAt" TIMESTAMPTZ(3),
    "validUntil" TIMESTAMPTZ(3),
    "parserVersion" TEXT,
    "sourceRecordKey" TEXT NOT NULL,
    "sourceContentHash" TEXT,
    "priceType" "PriceType" NOT NULL,
    "price" DECIMAL(18,4),
    "priceMin" DECIMAL(18,4),
    "priceMax" DECIMAL(18,4),
    "currency" CHAR(3) NOT NULL DEFAULT 'KZT',
    "taxStatus" "TaxStatus" NOT NULL DEFAULT 'unknown',
    "unitCode" TEXT NOT NULL,
    "unitLabelRaw" TEXT,
    "regionCode" TEXT,
    "cityName" TEXT,
    "includedItems" JSONB,
    "excludedItems" JSONB,
    "requiresInspection" BOOLEAN NOT NULL DEFAULT false,
    "isMarketOrientator" BOOLEAN NOT NULL DEFAULT false,
    "provenance" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "public_price_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_import_runs" (
    "id" TEXT NOT NULL,
    "sourceProviderId" TEXT NOT NULL,
    "status" "SourceImportRunStatus" NOT NULL DEFAULT 'running',
    "parserVersion" TEXT,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "addedCount" INTEGER NOT NULL DEFAULT 0,
    "changedCount" INTEGER NOT NULL DEFAULT 0,
    "removedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "report" JSONB,

    CONSTRAINT "source_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_data_versions" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "notes" TEXT,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "catalog_data_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "source_providers_code_key" ON "source_providers"("code");

-- CreateIndex
CREATE INDEX "public_price_listings_catalogItemId_idx" ON "public_price_listings"("catalogItemId");

-- CreateIndex
CREATE INDEX "public_price_listings_lifecycle_isMarketOrientator_idx" ON "public_price_listings"("lifecycle", "isMarketOrientator");

-- CreateIndex
CREATE INDEX "public_price_listings_sourceDomain_idx" ON "public_price_listings"("sourceDomain");

-- CreateIndex
CREATE UNIQUE INDEX "public_price_listings_sourceProviderId_sourceRecordKey_key" ON "public_price_listings"("sourceProviderId", "sourceRecordKey");

-- CreateIndex
CREATE INDEX "source_import_runs_sourceProviderId_startedAt_idx" ON "source_import_runs"("sourceProviderId", "startedAt");

-- AddForeignKey
ALTER TABLE "public_price_listings" ADD CONSTRAINT "public_price_listings_sourceProviderId_fkey" FOREIGN KEY ("sourceProviderId") REFERENCES "source_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_price_listings" ADD CONSTRAINT "public_price_listings_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_import_runs" ADD CONSTRAINT "source_import_runs_sourceProviderId_fkey" FOREIGN KEY ("sourceProviderId") REFERENCES "source_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

