import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  requireAuthContext,
  requirePlatformAdmin,
} from "@/modules/organizations/access";
import { AccessDeniedError, NotFoundError } from "@/lib/permissions";
import { writeAudit } from "./audit";
import {
  detectDangerousFormula,
  guessMapping,
  parseDecimalInput,
  parseImportBuffer,
  sanitizeImportText,
  type ColumnMapping,
  type ImportCanonicalField,
} from "./import-parse";
import type {
  AvailabilityStatus,
  PriceType,
  Prisma,
  VatMode,
} from "@prisma/client";

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 10;
const rateMap = new Map<string, { count: number; resetAt: number }>();

export class ImportRateLimitError extends Error {
  constructor() {
    super("Слишком много импортов, подождите минуту");
    this.name = "ImportRateLimitError";
  }
}

function checkRate(userId: string) {
  const now = Date.now();
  const cur = rateMap.get(userId);
  if (!cur || cur.resetAt < now) {
    rateMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }
  cur.count += 1;
  if (cur.count > RATE_LIMIT) throw new ImportRateLimitError();
}

export type MatchKind =
  | "update_offer"
  | "match_catalog_sku"
  | "match_exact_name_unit"
  | "create_item"
  | "needs_review"
  | "error";

export type PreviewRow = {
  rowNumber: number;
  raw: Record<string, string>;
  mapped: Partial<Record<ImportCanonicalField, string | null>>;
  match: MatchKind;
  catalogItemId?: string | null;
  offerId?: string | null;
  errors: string[];
  warnings: string[];
  selected: boolean;
};

async function assertCanImport(userId: string, organizationId: string) {
  try {
    await requirePlatformAdmin(userId);
    return { asPlatformAdmin: true as const };
  } catch {
    const ctx = await requireAuthContext(userId, "offer:manage");
    if (ctx.organizationId !== organizationId) {
      throw new AccessDeniedError("Можно импортировать только в свою организацию");
    }
    return { asPlatformAdmin: false as const, ctx };
  }
}

export async function createImportJob(opts: {
  userId: string;
  organizationId: string;
  fileName: string;
  buffer: Buffer;
}) {
  checkRate(opts.userId);
  await assertCanImport(opts.userId, opts.organizationId);

  const lower = opts.fileName.toLowerCase();
  const format = lower.endsWith(".xlsx")
    ? "xlsx"
    : lower.endsWith(".csv")
      ? "csv"
      : null;
  if (!format) {
    throw new Error("Поддерживаются только .csv и .xlsx");
  }
  if (opts.buffer.byteLength > MAX_IMPORT_BYTES) {
    throw new Error(`Файл больше ${MAX_IMPORT_BYTES} байт`);
  }
  // Reject zip bombs / oversized xlsx loosely by byte size already;
  // refuse embedded macros by extension only (.xlsm not allowed).

  const parsed = await parseImportBuffer(opts.buffer, format);
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Больше ${MAX_IMPORT_ROWS} строк`);
  }

  const mapping = guessMapping(parsed.headers);
  const sha = createHash("sha256").update(opts.buffer).digest("hex");

  const job = await prisma.importJob.create({
    data: {
      organizationId: opts.organizationId,
      createdById: opts.userId,
      status: "uploaded",
      format,
      fileName: opts.fileName.slice(0, 200),
      fileSha256: sha,
      byteSize: opts.buffer.byteLength,
      headers: parsed.headers,
      columnMapping: mapping,
      previewRows: parsed.rows,
    },
  });

  await writeAudit({
    actorUserId: opts.userId,
    organizationId: opts.organizationId,
    entityType: "ImportJob",
    entityId: job.id,
    action: "upload",
    after: {
      fileName: job.fileName,
      byteSize: job.byteSize,
      rows: parsed.rows.length,
    },
  });

  return job;
}

function cell(
  raw: Record<string, string>,
  mapping: ColumnMapping,
  field: ImportCanonicalField,
): string {
  const header = mapping[field];
  if (!header) return "";
  return raw[header] ?? "";
}

export async function buildPreview(opts: {
  userId: string;
  jobId: string;
  columnMapping?: ColumnMapping;
}): Promise<{ jobId: string; rows: PreviewRow[]; summary: Record<string, number> }> {
  const job = await prisma.importJob.findUnique({ where: { id: opts.jobId } });
  if (!job) throw new NotFoundError("Import job not found");
  await assertCanImport(opts.userId, job.organizationId);

  const mapping = (opts.columnMapping ??
    (job.columnMapping as ColumnMapping) ??
    {}) as ColumnMapping;
  const rawRows = (job.previewRows as Record<string, string>[]) ?? [];

  const [units, categories, offers, items] = await Promise.all([
    prisma.unit.findMany(),
    prisma.category.findMany(),
    prisma.offer.findMany({
      where: { supplierOrganizationId: job.organizationId },
    }),
    prisma.catalogItem.findMany({
      where: { status: "active" },
      include: { baseUnit: true },
    }),
  ]);

  const unitByCode = new Map(units.map((u) => [u.code.toLowerCase(), u]));
  const catBySlug = new Map(categories.map((c) => [c.slug.toLowerCase(), c]));
  const offerBySku = new Map(
    offers
      .filter((o) => o.supplierSku)
      .map((o) => [o.supplierSku!.toLowerCase(), o]),
  );
  const itemBySku = new Map(
    items.filter((i) => i.sku).map((i) => [i.sku!.toLowerCase(), i]),
  );
  const itemsByNameUnit = new Map<string, typeof items>();
  for (const it of items) {
    const key = `${normalizeName(it.name)}|${it.baseUnit.code.toLowerCase()}`;
    const list = itemsByNameUnit.get(key) ?? [];
    list.push(it);
    itemsByNameUnit.set(key, list);
  }

  const skuSeen = new Map<string, number>();
  const rows: PreviewRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNumber = i + 2; // header = 1
    const errors: string[] = [];
    const warnings: string[] = [];
    const mapped: PreviewRow["mapped"] = {};

    for (const field of Object.keys(mapping) as ImportCanonicalField[]) {
      mapped[field] = cell(raw, mapping, field);
    }

    const nameRaw = cell(raw, mapping, "name");
    const supplierSku = sanitizeImportText(cell(raw, mapping, "supplierSku"));
    const name = sanitizeImportText(nameRaw);
    const unitCode = sanitizeImportText(cell(raw, mapping, "unit")).toLowerCase();
    const categorySlug = sanitizeImportText(cell(raw, mapping, "category")).toLowerCase();
    const catalogSku = sanitizeImportText(cell(raw, mapping, "catalogSku"));
    const priceTypeRaw = sanitizeImportText(cell(raw, mapping, "priceType")).toLowerCase() || "fixed";
    const priceRaw = cell(raw, mapping, "price");

    mapped.name = name;
    mapped.supplierSku = supplierSku || null;
    mapped.unit = unitCode || null;
    mapped.category = categorySlug || null;
    mapped.catalogSku = catalogSku || null;
    mapped.priceType = priceTypeRaw;
    mapped.price = priceRaw.trim() || null;

    if (detectDangerousFormula(nameRaw) || detectDangerousFormula(cell(raw, mapping, "supplierSku"))) {
      warnings.push("Опасный текст формулы обезврежен");
    }
    if (!name) errors.push("Нет названия");
    if (!unitCode) errors.push("Нет единицы");
    else if (!unitByCode.has(unitCode)) errors.push(`Неверная единица: ${unitCode}`);
    if (categorySlug && !catBySlug.has(categorySlug)) {
      errors.push(`Неизвестная категория: ${categorySlug}`);
    }

    const priceTypes = new Set(["fixed", "from", "range", "on_request"]);
    if (!priceTypes.has(priceTypeRaw)) errors.push(`Неверный тип цены: ${priceTypeRaw}`);

    let price: string | null = null;
    try {
      price = parseDecimalInput(priceRaw);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Ошибка цены");
    }
    // Empty price must NOT become zero
    if (price === "0" && !priceRaw.trim()) {
      price = null;
    }
    if (!priceRaw.trim()) {
      mapped.priceType = "on_request";
      mapped.price = null;
    } else {
      mapped.price = price;
    }

    if (supplierSku) {
      const prev = skuSeen.get(supplierSku.toLowerCase());
      if (prev != null) {
        errors.push(`Конфликт артикула с строкой ${prev}`);
      } else {
        skuSeen.set(supplierSku.toLowerCase(), rowNumber);
      }
    }

    let match: MatchKind = "create_item";
    let catalogItemId: string | null = null;
    let offerId: string | null = null;

    if (errors.length) {
      match = "error";
    } else if (supplierSku && offerBySku.has(supplierSku.toLowerCase())) {
      const offer = offerBySku.get(supplierSku.toLowerCase())!;
      match = "update_offer";
      offerId = offer.id;
      catalogItemId = offer.catalogItemId;
    } else if (catalogSku && itemBySku.has(catalogSku.toLowerCase())) {
      match = "match_catalog_sku";
      catalogItemId = itemBySku.get(catalogSku.toLowerCase())!.id;
    } else {
      const key = `${normalizeName(name)}|${unitCode}`;
      const exact = itemsByNameUnit.get(key) ?? [];
      if (exact.length === 1) {
        match = "match_exact_name_unit";
        catalogItemId = exact[0].id;
      } else if (exact.length > 1) {
        match = "needs_review";
        warnings.push("Несколько карточек с тем же именем и единицей");
      } else {
        // Similar name only → do not auto-merge
        const similar = items.filter(
          (it) =>
            normalizeName(it.name) !== normalizeName(name) &&
            tokenize(it.name).some((t) => tokenize(name).includes(t) && t.length > 3),
        );
        if (similar.length > 0 && !catalogSku) {
          match = "needs_review";
          warnings.push("Похожее название — нужна ручная проверка");
        } else {
          match = "create_item";
        }
      }
    }

    rows.push({
      rowNumber,
      raw,
      mapped,
      match,
      catalogItemId,
      offerId,
      errors,
      warnings,
      selected: errors.length === 0 && match !== "needs_review",
    });
  }

  const summary: Record<string, number> = {
    total: rows.length,
    valid: rows.filter((r) => r.errors.length === 0).length,
    errors: rows.filter((r) => r.errors.length).length,
    needs_review: rows.filter((r) => r.match === "needs_review").length,
    update_offer: rows.filter((r) => r.match === "update_offer").length,
    create_item: rows.filter((r) => r.match === "create_item").length,
  };

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: "previewed",
      columnMapping: mapping,
      report: { summary, rows },
    },
  });

  return { jobId: job.id, rows, summary };
}

function normalizeName(s: string) {
  return s
    .toLowerCase()
    .replace(/[×xх]/gi, "x")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string) {
  return normalizeName(s).split(/[^a-zа-яё0-9.]+/i).filter(Boolean);
}

export async function commitImport(opts: {
  userId: string;
  jobId: string;
  /** rowNumbers to apply; default = selected valid non-review */
  rowNumbers?: number[];
}) {
  const job = await prisma.importJob.findUnique({ where: { id: opts.jobId } });
  if (!job) throw new NotFoundError("Import job not found");
  await assertCanImport(opts.userId, job.organizationId);
  if (job.status === "committed") {
    return { duplicated: true, report: job.report };
  }
  if (job.status !== "previewed" || !job.report) {
    throw new Error("Сначала выполните предпросмотр");
  }

  const report = job.report as { rows: PreviewRow[]; summary: Record<string, number> };
  const mapping = (job.columnMapping as ColumnMapping) ?? {};
  let toApply = report.rows.filter((r) => r.errors.length === 0);
  if (opts.rowNumbers?.length) {
    const set = new Set(opts.rowNumbers);
    toApply = toApply.filter((r) => set.has(r.rowNumber));
  } else {
    toApply = toApply.filter((r) => r.selected && r.match !== "needs_review");
  }

  const units = await prisma.unit.findMany();
  const categories = await prisma.category.findMany();
  const unitByCode = new Map(units.map((u) => [u.code.toLowerCase(), u]));
  const catBySlug = new Map(categories.map((c) => [c.slug.toLowerCase(), c]));
  const defaultCategory =
    categories.find((c) => c.slug === "cable") ?? categories[0];
  if (!defaultCategory) throw new Error("Нет категорий в справочнике");

  // Snapshot count before (prove versions untouched)
  const versionCountBefore = await prisma.estimateVersion.count();

  const applied: Array<{ rowNumber: number; offerId: string; action: string }> = [];

  await prisma.$transaction(async (tx) => {
    for (const row of toApply) {
      const m = row.mapped;
      const unit = unitByCode.get((m.unit ?? "").toLowerCase());
      if (!unit) continue;
      const cat =
        (m.category && catBySlug.get(m.category.toLowerCase())) ||
        defaultCategory;

      let catalogItemId = row.catalogItemId ?? null;
      if (!catalogItemId) {
        const created = await tx.catalogItem.create({
          data: {
            kind: cat.kind,
            categoryId: cat.id,
            name: m.name || "Без названия",
            sku: m.catalogSku || null,
            baseUnitId: unit.id,
            isDemo: true,
            status: "active",
          },
        });
        catalogItemId = created.id;
        await writeAudit({
          actorUserId: opts.userId,
          organizationId: job.organizationId,
          entityType: "CatalogItem",
          entityId: created.id,
          action: "import_create",
          after: { name: created.name, sku: created.sku },
        });
      }

      const priceType = (m.priceType || "fixed") as PriceType;
      const price =
        !m.price || priceType === "on_request" ? null : m.price;
      const vatMode = (sanitizeImportText(cell(row.raw, mapping, "vatMode")) ||
        "excluded") as VatMode;
      const vatRateRaw = cell(row.raw, mapping, "vatRate");
      let vatRate: string | null = null;
      try {
        vatRate = parseDecimalInput(vatRateRaw);
      } catch {
        vatRate = null;
      }
      const availability = (sanitizeImportText(
        cell(row.raw, mapping, "availability"),
      ) || "unknown") as AvailabilityStatus;
      let moq: string | null = null;
      let packQty: string | null = null;
      let lead: number | null = null;
      try {
        moq = parseDecimalInput(cell(row.raw, mapping, "moq"));
        packQty = parseDecimalInput(cell(row.raw, mapping, "packQty"));
        const lt = cell(row.raw, mapping, "leadTimeDays").trim();
        lead = lt ? Number(lt) : null;
        if (lead != null && Number.isNaN(lead)) lead = null;
      } catch {
        /* keep nulls */
      }
      const validUntilRaw = cell(row.raw, mapping, "validUntil").trim();
      const validUntil = validUntilRaw ? new Date(validUntilRaw) : null;

      const offerData: Prisma.OfferUncheckedCreateInput = {
        supplierOrganizationId: job.organizationId,
        catalogItemId,
        priceType: price == null ? "on_request" : priceType,
        price,
        currency: (m.currency || "KZT").slice(0, 3).toUpperCase() || "KZT",
        inputVatMode: ["included", "excluded", "zero", "not_specified"].includes(
          vatMode,
        )
          ? vatMode
          : "not_specified",
        inputVatRate: vatRate,
        unknownPriceReason: price == null ? "imported empty price" : null,
        availability: [
          "in_stock",
          "made_to_order",
          "limited",
          "unknown",
        ].includes(availability)
          ? availability
          : "unknown",
        moq,
        packQty,
        leadTimeDays: lead,
        validUntil:
          validUntil && !Number.isNaN(validUntil.getTime()) ? validUntil : null,
        source: "import",
        moderationStatus: "pending",
        supplierSku: m.supplierSku || null,
        isDemo: true,
      };

      let offerId: string;
      let action: string;
      if (row.offerId) {
        const before = await tx.offer.findUnique({ where: { id: row.offerId } });
        const updated = await tx.offer.update({
          where: { id: row.offerId },
          data: {
            priceType: offerData.priceType,
            price: offerData.price,
            currency: offerData.currency,
            inputVatMode: offerData.inputVatMode,
            inputVatRate: offerData.inputVatRate,
            unknownPriceReason: offerData.unknownPriceReason,
            availability: offerData.availability,
            moq: offerData.moq,
            packQty: offerData.packQty,
            leadTimeDays: offerData.leadTimeDays,
            validUntil: offerData.validUntil,
            source: "import",
            moderationStatus: "pending",
          },
        });
        offerId = updated.id;
        action = "update";
        await writeAudit({
          actorUserId: opts.userId,
          organizationId: job.organizationId,
          entityType: "Offer",
          entityId: offerId,
          action: "import_update",
          before: before
            ? { price: before.price?.toString(), priceType: before.priceType }
            : undefined,
          after: { price: updated.price?.toString(), priceType: updated.priceType },
        });
      } else {
        const created = await tx.offer.create({ data: offerData });
        offerId = created.id;
        action = "create";
        await writeAudit({
          actorUserId: opts.userId,
          organizationId: job.organizationId,
          entityType: "Offer",
          entityId: offerId,
          action: "import_create",
          after: { price: created.price?.toString(), supplierSku: created.supplierSku },
        });
      }
      applied.push({ rowNumber: row.rowNumber, offerId, action });
    }

    await tx.importJob.update({
      where: { id: job.id },
      data: {
        status: "committed",
        committedAt: new Date(),
        report: {
          ...report,
          applied,
          versionCountBefore,
          versionCountAfter: await tx.estimateVersion.count(),
        },
      },
    });
  });

  const versionCountAfter = await prisma.estimateVersion.count();
  if (versionCountAfter !== versionCountBefore) {
    // Should never happen — import must not touch snapshots
    throw new Error("Инвариант нарушен: изменились снимки смет");
  }

  return {
    duplicated: false,
    applied: applied.length,
    versionCountUnchanged: true,
  };
}

export async function cancelImport(userId: string, jobId: string) {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError("Import job not found");
  await assertCanImport(userId, job.organizationId);
  if (job.status === "committed") throw new Error("Уже применён");
  return prisma.importJob.update({
    where: { id: jobId },
    data: { status: "cancelled" },
  });
}

export async function getImportJob(userId: string, jobId: string) {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job) throw new NotFoundError("Import job not found");
  await assertCanImport(userId, job.organizationId);
  return job;
}
