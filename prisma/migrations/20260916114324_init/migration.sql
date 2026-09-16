-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('buyer', 'supplier', 'contractor', 'mixed');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('owner', 'admin', 'estimator', 'buyer', 'supplier_manager', 'viewer', 'platform_admin');

-- CreateEnum
CREATE TYPE "CatalogItemKind" AS ENUM ('product', 'service');

-- CreateEnum
CREATE TYPE "CatalogItemStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "AttributeValueType" AS ENUM ('text', 'number', 'boolean', 'enum');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('fixed', 'from', 'range', 'on_request');

-- CreateEnum
CREATE TYPE "VatMode" AS ENUM ('included', 'excluded', 'zero', 'not_specified');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('in_stock', 'made_to_order', 'limited', 'unknown');

-- CreateEnum
CREATE TYPE "OfferSource" AS ENUM ('manual', 'import', 'api');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('draft', 'pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('equipment', 'material', 'labor', 'machinery', 'logistics', 'other');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('draft', 'archived');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('prepared', 'sent', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('commercial_preliminary', 'commercial_fixed');

-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('draft', 'confirmed', 'pending_quote');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('amount', 'percent');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('draft', 'submitted', 'viewed', 'responded', 'accepted', 'declined', 'cancelled');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('pdf', 'xlsx', 'docx', 'csv');

-- CreateEnum
CREATE TYPE "ExportVariant" AS ENUM ('client', 'internal');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('queued', 'running', 'ready', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "bin" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Almaty',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameKk" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameKk" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameKk" TEXT,
    "dimension" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "slug" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameKk" TEXT,
    "kind" "CatalogItemKind" NOT NULL,
    "isNavigable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameKk" TEXT,
    "valueType" "AttributeValueType" NOT NULL,
    "normalizedUnitId" TEXT,
    "enumOptions" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_attributes" (
    "categoryId" TEXT NOT NULL,
    "attributeDefinitionId" TEXT NOT NULL,
    "isFilterable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "category_attributes_pkey" PRIMARY KEY ("categoryId","attributeDefinitionId")
);

-- CreateTable
CREATE TABLE "catalog_items" (
    "id" TEXT NOT NULL,
    "kind" "CatalogItemKind" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "model" TEXT,
    "baseUnitId" TEXT NOT NULL,
    "description" TEXT,
    "serviceScope" JSONB,
    "status" "CatalogItemStatus" NOT NULL DEFAULT 'active',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_item_attributes" (
    "id" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "attributeDefinitionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "normalizedValue" DECIMAL(24,8),

    CONSTRAINT "catalog_item_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "supplierOrganizationId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "priceType" "PriceType" NOT NULL,
    "price" DECIMAL(18,4),
    "priceMin" DECIMAL(18,4),
    "priceMax" DECIMAL(18,4),
    "currency" CHAR(3) NOT NULL DEFAULT 'KZT',
    "inputVatMode" "VatMode" NOT NULL DEFAULT 'not_specified',
    "inputVatRate" DECIMAL(8,4),
    "unknownPriceReason" TEXT,
    "availability" "AvailabilityStatus" NOT NULL DEFAULT 'unknown',
    "moq" DECIMAL(18,4),
    "packQty" DECIMAL(18,4),
    "leadTimeDays" INTEGER,
    "source" "OfferSource" NOT NULL DEFAULT 'manual',
    "validFrom" TIMESTAMPTZ(3),
    "validUntil" TIMESTAMPTZ(3),
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'approved',
    "supplierSku" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_regions" (
    "offerId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,

    CONSTRAINT "offer_regions_pkey" PRIMARY KEY ("offerId","regionId")
);

-- CreateTable
CREATE TABLE "offer_cities" (
    "offerId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,

    CONSTRAINT "offer_cities_pkey" PRIMARY KEY ("offerId","cityId")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cityId" TEXT,
    "objectName" TEXT,
    "objectAddress" TEXT,
    "clientName" TEXT,
    "clientContacts" JSONB,
    "description" TEXT,
    "assumptions" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Almaty',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KZT',
    "draftRevision" INTEGER NOT NULL DEFAULT 1,
    "status" "EstimateStatus" NOT NULL DEFAULT 'draft',
    "proposalStatus" "ProposalStatus" NOT NULL DEFAULT 'prepared',
    "calculationPolicyVersion" TEXT NOT NULL DEFAULT 'commercial-v1',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_sections" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_lines" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "sectionId" TEXT,
    "catalogItemId" TEXT,
    "offerId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "costType" "CostType" NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "unitSnapshot" TEXT NOT NULL,
    "qty" DECIMAL(18,6) NOT NULL,
    "purchaseQty" DECIMAL(18,6),
    "unitPurchasePrice" DECIMAL(18,4),
    "purchaseVatMode" "VatMode",
    "purchaseVatRate" DECIMAL(8,4),
    "unitSalePrice" DECIMAL(18,4),
    "saleVatMode" "VatMode",
    "saleVatRate" DECIMAL(8,4),
    "priceType" "PriceType",
    "confirmationStatus" "ConfirmationStatus" NOT NULL DEFAULT 'draft',
    "discountPercent" DECIMAL(8,4),
    "discountAmount" DECIMAL(18,4),
    "markupPercent" DECIMAL(8,4),
    "targetMarginPercent" DECIMAL(8,4),
    "supplierOrganizationId" TEXT,
    "supplierNameSnapshot" TEXT,
    "sourceLabel" TEXT,
    "sourcedAt" TIMESTAMPTZ(3),
    "unknownPriceReason" TEXT,
    "manualOverrideReason" TEXT,
    "includedInServiceLineId" TEXT,
    "notesInternal" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "estimate_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjustments" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "baseLineIds" JSONB NOT NULL,
    "vatMode" "VatMode" NOT NULL DEFAULT 'not_specified',
    "vatRate" DECIMAL(8,4),
    "applyOrder" INTEGER NOT NULL DEFAULT 0,
    "costType" "CostType" NOT NULL DEFAULT 'other',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_versions" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "snapshot" JSONB NOT NULL,
    "calcResult" JSONB NOT NULL,
    "calculationPolicyVersion" TEXT NOT NULL,
    "documentKind" "DocumentKind" NOT NULL DEFAULT 'commercial_fixed',
    "immutable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "estimate_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "code" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "description" TEXT,
    "payload" JSONB NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_estimate_links" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_estimate_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_requests" (
    "id" TEXT NOT NULL,
    "buyerOrganizationId" TEXT NOT NULL,
    "supplierOrganizationId" TEXT NOT NULL,
    "estimateVersionId" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'draft',
    "idempotencyKey" TEXT NOT NULL,
    "objectInfoVisible" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "procurement_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_lines" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "sourceEstimateLineId" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "unitSnapshot" TEXT NOT NULL,
    "qty" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_responses" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "proposedPrice" DECIMAL(18,4),
    "proposedLeadTimeDays" INTEGER,
    "proposedAvailability" "AvailabilityStatus",
    "alternativeCatalogItemId" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_artifacts" (
    "id" TEXT NOT NULL,
    "versionId" TEXT,
    "format" "ExportFormat" NOT NULL,
    "variant" "ExportVariant" NOT NULL,
    "storageKey" TEXT,
    "status" "ExportStatus" NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "checksum" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "organizationId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_userId_key" ON "user_sessions"("userId");

-- CreateIndex
CREATE INDEX "memberships_organizationId_idx" ON "memberships"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_organizationId_key" ON "memberships"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "regions_code_key" ON "regions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cities_code_key" ON "cities"("code");

-- CreateIndex
CREATE INDEX "cities_regionId_idx" ON "cities"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "units_code_key" ON "units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_definitions_code_key" ON "attribute_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_items_sku_key" ON "catalog_items"("sku");

-- CreateIndex
CREATE INDEX "catalog_items_categoryId_idx" ON "catalog_items"("categoryId");

-- CreateIndex
CREATE INDEX "catalog_items_kind_status_idx" ON "catalog_items"("kind", "status");

-- CreateIndex
CREATE INDEX "catalog_item_attributes_attributeDefinitionId_idx" ON "catalog_item_attributes"("attributeDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_item_attributes_catalogItemId_attributeDefinitionId_key" ON "catalog_item_attributes"("catalogItemId", "attributeDefinitionId");

-- CreateIndex
CREATE INDEX "offers_catalogItemId_idx" ON "offers"("catalogItemId");

-- CreateIndex
CREATE INDEX "offers_supplierOrganizationId_idx" ON "offers"("supplierOrganizationId");

-- CreateIndex
CREATE INDEX "offers_validUntil_idx" ON "offers"("validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "offers_supplierOrganizationId_supplierSku_key" ON "offers"("supplierOrganizationId", "supplierSku");

-- CreateIndex
CREATE INDEX "projects_organizationId_idx" ON "projects"("organizationId");

-- CreateIndex
CREATE INDEX "estimates_projectId_idx" ON "estimates"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_projectId_number_key" ON "estimates"("projectId", "number");

-- CreateIndex
CREATE INDEX "estimate_sections_estimateId_idx" ON "estimate_sections"("estimateId");

-- CreateIndex
CREATE INDEX "estimate_lines_estimateId_idx" ON "estimate_lines"("estimateId");

-- CreateIndex
CREATE INDEX "estimate_lines_sectionId_idx" ON "estimate_lines"("sectionId");

-- CreateIndex
CREATE INDEX "adjustments_estimateId_idx" ON "adjustments"("estimateId");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_versions_estimateId_versionNumber_key" ON "estimate_versions"("estimateId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_templates_code_key" ON "estimate_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "public_estimate_links_token_key" ON "public_estimate_links"("token");

-- CreateIndex
CREATE INDEX "public_estimate_links_versionId_idx" ON "public_estimate_links"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_requests_idempotencyKey_key" ON "procurement_requests"("idempotencyKey");

-- CreateIndex
CREATE INDEX "procurement_requests_buyerOrganizationId_idx" ON "procurement_requests"("buyerOrganizationId");

-- CreateIndex
CREATE INDEX "procurement_requests_supplierOrganizationId_idx" ON "procurement_requests"("supplierOrganizationId");

-- CreateIndex
CREATE INDEX "request_lines_requestId_idx" ON "request_lines"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_responses_requestId_version_key" ON "supplier_responses"("requestId", "version");

-- CreateIndex
CREATE INDEX "export_artifacts_versionId_idx" ON "export_artifacts"("versionId");

-- CreateIndex
CREATE INDEX "audit_events_organizationId_createdAt_idx" ON "audit_events"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_activeOrganizationId_fkey" FOREIGN KEY ("activeOrganizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_definitions" ADD CONSTRAINT "attribute_definitions_normalizedUnitId_fkey" FOREIGN KEY ("normalizedUnitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_attributes" ADD CONSTRAINT "category_attributes_attributeDefinitionId_fkey" FOREIGN KEY ("attributeDefinitionId") REFERENCES "attribute_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_baseUnitId_fkey" FOREIGN KEY ("baseUnitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_item_attributes" ADD CONSTRAINT "catalog_item_attributes_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_item_attributes" ADD CONSTRAINT "catalog_item_attributes_attributeDefinitionId_fkey" FOREIGN KEY ("attributeDefinitionId") REFERENCES "attribute_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_supplierOrganizationId_fkey" FOREIGN KEY ("supplierOrganizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_regions" ADD CONSTRAINT "offer_regions_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_regions" ADD CONSTRAINT "offer_regions_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_cities" ADD CONSTRAINT "offer_cities_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_cities" ADD CONSTRAINT "offer_cities_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_sections" ADD CONSTRAINT "estimate_sections_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "estimate_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_supplierOrganizationId_fkey" FOREIGN KEY ("supplierOrganizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_includedInServiceLineId_fkey" FOREIGN KEY ("includedInServiceLineId") REFERENCES "estimate_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_versions" ADD CONSTRAINT "estimate_versions_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_versions" ADD CONSTRAINT "estimate_versions_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_templates" ADD CONSTRAINT "estimate_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_estimate_links" ADD CONSTRAINT "public_estimate_links_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "estimate_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_estimate_links" ADD CONSTRAINT "public_estimate_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_buyerOrganizationId_fkey" FOREIGN KEY ("buyerOrganizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_supplierOrganizationId_fkey" FOREIGN KEY ("supplierOrganizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_estimateVersionId_fkey" FOREIGN KEY ("estimateVersionId") REFERENCES "estimate_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_lines" ADD CONSTRAINT "request_lines_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_lines" ADD CONSTRAINT "request_lines_sourceEstimateLineId_fkey" FOREIGN KEY ("sourceEstimateLineId") REFERENCES "estimate_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_responses" ADD CONSTRAINT "supplier_responses_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_responses" ADD CONSTRAINT "supplier_responses_alternativeCatalogItemId_fkey" FOREIGN KEY ("alternativeCatalogItemId") REFERENCES "catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "estimate_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_artifacts" ADD CONSTRAINT "export_artifacts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
