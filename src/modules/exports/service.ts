import { createHash } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/modules/organizations/access";
import { NotFoundError, AccessDeniedError } from "@/lib/permissions";
import {
  getVersionForUser,
  buildSnapshot,
  type EstimateSnapshot,
  ConflictError,
} from "@/modules/estimates/versions";
import type { CalcResult } from "@/modules/pricing";
import { buildExportModel, canonicalTotals } from "./model";
import { renderCsv } from "./csv";
import { renderDocx } from "./docx";
import { renderXlsx } from "./xlsx";
import { renderPdf } from "./pdf";
import {
  safeFileBase,
  type ExportFormat,
  type ExportVariant,
} from "./sanitize";

const STORAGE_ROOT = path.join(process.cwd(), ".data", "exports");
const MAX_LINES = 500;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;

const rateMap = new Map<string, { count: number; resetAt: number }>();

export class ExportRateLimitError extends Error {
  constructor() {
    super("Слишком много запросов экспорта. Подождите минуту.");
    this.name = "ExportRateLimitError";
  }
}

export class ExportTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportTooLargeError";
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
  if (cur.count > RATE_LIMIT) throw new ExportRateLimitError();
}

async function ensureStorage() {
  await mkdir(STORAGE_ROOT, { recursive: true });
}

function contentType(format: ExportFormat): string {
  switch (format) {
    case "pdf":
      return "application/pdf";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "csv":
      return "text/csv; charset=utf-8";
  }
}

async function render(
  format: ExportFormat,
  model: ReturnType<typeof buildExportModel>,
): Promise<Buffer> {
  switch (format) {
    case "pdf":
      return renderPdf(model);
    case "xlsx":
      return renderXlsx(model);
    case "docx":
      return renderDocx(model);
    case "csv":
      return renderCsv(model);
  }
}

export async function exportVersionDocument(opts: {
  userId: string;
  versionId: string;
  format: ExportFormat;
  variant: ExportVariant;
}) {
  checkRate(opts.userId);

  if (opts.variant === "internal") {
    await requireAuthContext(opts.userId, "export:internal");
  } else {
    await requireAuthContext(opts.userId, "export:client");
  }

  const version = await getVersionForUser(opts.userId, opts.versionId);
  const snapshot = version.snapshot as unknown as EstimateSnapshot;
  const calc = version.calcResult as unknown as CalcResult;

  if (snapshot.lines.length > MAX_LINES) {
    throw new ExportTooLargeError(`Максимум ${MAX_LINES} строк в экспорте`);
  }

  const user = await prisma.user.findUnique({ where: { id: opts.userId } });
  const model = buildExportModel({
    snapshot,
    calc,
    variant: opts.variant,
    versionNumber: version.versionNumber,
    preliminary: version.documentKind === "commercial_preliminary",
    composerName: user?.name ?? user?.email ?? null,
  });

  const artifact = await prisma.exportArtifact.create({
    data: {
      versionId: version.id,
      format: opts.format,
      variant: opts.variant,
      status: "running",
      createdById: opts.userId,
    },
  });

  try {
    const buffer = await render(opts.format, model);
    await ensureStorage();
    const base = safeFileBase(
      `${snapshot.estimate.number}_${model.versionLabel}_${opts.variant}`,
    );
    const filename = `${base}.${opts.format}`;
    const storageKey = path.join(STORAGE_ROOT, `${artifact.id}_${filename}`);
    await writeFile(storageKey, buffer);
    const checksum = createHash("sha256").update(buffer).digest("hex");

    await prisma.exportArtifact.update({
      where: { id: artifact.id },
      data: {
        status: "ready",
        storageKey,
        checksum,
      },
    });

    return {
      artifactId: artifact.id,
      filename,
      contentType: contentType(opts.format),
      buffer,
      checksum,
      canonicalTotals: canonicalTotals(model),
      model,
    };
  } catch (e) {
    await prisma.exportArtifact.update({
      where: { id: artifact.id },
      data: {
        status: "failed",
        error: e instanceof Error ? e.message.slice(0, 500) : "export failed",
      },
    });
    throw e;
  }
}

/** Draft export: snapshot of current draft — does NOT create EstimateVersion. */
export async function exportDraftDocument(opts: {
  userId: string;
  estimateId: string;
  expectedRevision: number;
  format: ExportFormat;
  variant: ExportVariant;
}) {
  checkRate(opts.userId);

  if (opts.variant === "internal") {
    await requireAuthContext(opts.userId, "export:internal");
  } else {
    await requireAuthContext(opts.userId, "export:client");
  }

  const ctx = await requireAuthContext(opts.userId, "estimate:read");
  const estimate = await prisma.estimate.findUnique({
    where: { id: opts.estimateId },
    include: { project: true },
  });
  if (!estimate || estimate.project.organizationId !== ctx.organizationId) {
    throw new NotFoundError("Estimate not found");
  }
  if (estimate.draftRevision !== opts.expectedRevision) {
    throw new ConflictError(
      `На сервере есть более новая редакция сметы (ревизия ${estimate.draftRevision}).`,
    );
  }

  const { snapshot, calc } = await buildSnapshot(opts.userId, opts.estimateId);

  // Re-check after snapshot (another writer may have raced)
  const again = await prisma.estimate.findUnique({ where: { id: opts.estimateId } });
  if (!again || again.draftRevision !== opts.expectedRevision) {
    throw new ConflictError(
      `На сервере есть более новая редакция сметы (ревизия ${again?.draftRevision ?? "?"}).`,
    );
  }

  if (snapshot.lines.length > MAX_LINES) {
    throw new ExportTooLargeError(`Максимум ${MAX_LINES} строк в экспорте`);
  }

  const user = await prisma.user.findUnique({ where: { id: opts.userId } });
  const model = buildExportModel({
    snapshot,
    calc,
    variant: opts.variant,
    versionNumber: 0,
    versionLabel: `черновик r${opts.expectedRevision}`,
    preliminary: true,
    composerName: user?.name ?? user?.email ?? null,
  });

  const artifact = await prisma.exportArtifact.create({
    data: {
      versionId: null,
      format: opts.format,
      variant: opts.variant,
      status: "running",
      createdById: opts.userId,
    },
  });

  try {
    const buffer = await render(opts.format, model);
    await ensureStorage();
    const base = safeFileBase(
      `${snapshot.estimate.number}_draft-r${opts.expectedRevision}_${opts.variant}`,
    );
    const filename = `${base}.${opts.format}`;
    const storageKey = path.join(STORAGE_ROOT, `${artifact.id}_${filename}`);
    await writeFile(storageKey, buffer);
    const checksum = createHash("sha256").update(buffer).digest("hex");

    await prisma.exportArtifact.update({
      where: { id: artifact.id },
      data: { status: "ready", storageKey, checksum },
    });

    return {
      artifactId: artifact.id,
      filename,
      contentType: contentType(opts.format),
      buffer,
      checksum,
      canonicalTotals: canonicalTotals(model),
      model,
      draftRevision: opts.expectedRevision,
    };
  } catch (e) {
    await prisma.exportArtifact.update({
      where: { id: artifact.id },
      data: {
        status: "failed",
        error: e instanceof Error ? e.message.slice(0, 500) : "export failed",
      },
    });
    throw e;
  }
}

export async function getExportArtifactForUser(userId: string, artifactId: string) {
  const ctx = await requireAuthContext(userId, "export:client");
  const artifact = await prisma.exportArtifact.findUnique({
    where: { id: artifactId },
    include: {
      version: { include: { estimate: { include: { project: true } } } },
    },
  });
  if (!artifact?.version) throw new NotFoundError("Export not found");
  if (artifact.version.estimate.project.organizationId !== ctx.organizationId) {
    throw new NotFoundError("Export not found");
  }
  if (artifact.variant === "internal") {
    await requireAuthContext(userId, "export:internal");
  }
  if (artifact.status !== "ready" || !artifact.storageKey) {
    throw new NotFoundError("Export not ready");
  }
  return artifact;
}

export async function cleanupExportFile(storageKey: string) {
  try {
    await unlink(storageKey);
  } catch {
    // ignore missing
  }
}

export { buildSnapshot, AccessDeniedError, NotFoundError, contentType, STORAGE_ROOT };
