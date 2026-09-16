import { createHash, randomUUID } from "node:crypto";
import type { AvailabilityStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuthContext } from "@/modules/organizations/access";
import { AccessDeniedError, NotFoundError } from "@/lib/permissions";
import { getVersionForUser, type EstimateSnapshot } from "@/modules/estimates/versions";
import { getNotificationAdapter } from "@/modules/notifications/port";
import { ensureDraftEstimate } from "@/modules/estimates/draft";

export type PreviewGroup = {
  supplierOrganizationId: string | null;
  supplierName: string | null;
  lines: Array<{
    estimateLineId: string;
    name: string;
    unit: string;
    qty: string;
  }>;
};

/** Preview split by supplier from version snapshot — no side effects. */
export async function previewRequestsFromVersion(userId: string, versionId: string) {
  await requireAuthContext(userId, "request:create");
  const version = await getVersionForUser(userId, versionId);
  const snapshot = version.snapshot as unknown as EstimateSnapshot;

  const groups = new Map<string, PreviewGroup>();
  const unassigned: PreviewGroup = {
    supplierOrganizationId: null,
    supplierName: null,
    lines: [],
  };

  for (const raw of snapshot.lines) {
    const supplierId = (raw.supplierOrganizationId as string | null) ?? null;
    const line = {
      estimateLineId: String(raw.id),
      name: String(raw.nameSnapshot ?? ""),
      unit: String(raw.unitSnapshot ?? ""),
      qty: String(raw.qty ?? "0"),
    };
    if (!supplierId) {
      unassigned.lines.push(line);
      continue;
    }
    const key = supplierId;
    if (!groups.has(key)) {
      groups.set(key, {
        supplierOrganizationId: supplierId,
        supplierName: (raw.supplierNameSnapshot as string | null) ?? "Поставщик",
        lines: [],
      });
    }
    groups.get(key)!.lines.push(line);
  }

  return {
    versionId,
    groups: [...groups.values()],
    unassigned,
    note: "Неназначенные строки не отправляются автоматически.",
  };
}

function buildIdempotencyKey(parts: string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export async function submitProcurementRequests(opts: {
  userId: string;
  versionId: string;
  /** Explicit recipient assignments: supplierOrgId -> estimateLineIds */
  assignments: Array<{ supplierOrganizationId: string; estimateLineIds: string[] }>;
  objectInfoVisible?: {
    objectName?: string | null;
    cityName?: string | null;
    contactVisible?: boolean;
  };
  idempotencyKey?: string;
}) {
  const ctx = await requireAuthContext(opts.userId, "request:create");
  const version = await getVersionForUser(opts.userId, opts.versionId);
  const snapshot = version.snapshot as unknown as EstimateSnapshot;
  const lineMap = new Map(snapshot.lines.map((l) => [String(l.id), l]));

  const batchKey =
    opts.idempotencyKey ??
    buildIdempotencyKey([
      opts.versionId,
      ctx.organizationId,
      JSON.stringify(
        opts.assignments
          .map((a) => ({
            s: a.supplierOrganizationId,
            l: [...a.estimateLineIds].sort(),
          }))
          .sort((a, b) => a.s.localeCompare(b.s)),
      ),
    ]);

  // If entire batch already created under this key prefix, return existing
  const existing = await prisma.procurementRequest.findMany({
    where: {
      estimateVersionId: opts.versionId,
      buyerOrganizationId: ctx.organizationId,
      idempotencyKey: { startsWith: batchKey.slice(0, 40) },
    },
    include: { lines: true },
  });
  if (existing.length > 0 && existing.length === opts.assignments.length) {
    return { requests: existing, duplicated: true };
  }

  const created = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const assignment of opts.assignments) {
      if (assignment.estimateLineIds.length === 0) continue;

      const key = `${batchKey}:${assignment.supplierOrganizationId}`;
      const prior = await tx.procurementRequest.findUnique({
        where: { idempotencyKey: key },
        include: { lines: true },
      });
      if (prior) {
        out.push(prior);
        continue;
      }

      const supplier = await tx.organization.findFirst({
        where: {
          id: assignment.supplierOrganizationId,
          type: { in: ["supplier", "contractor", "mixed"] },
          status: "active",
        },
      });
      if (!supplier) {
        throw new NotFoundError(`Supplier ${assignment.supplierOrganizationId} not found`);
      }

      const req = await tx.procurementRequest.create({
        data: {
          buyerOrganizationId: ctx.organizationId,
          supplierOrganizationId: supplier.id,
          estimateVersionId: version.id,
          status: "submitted",
          idempotencyKey: key,
          objectInfoVisible: {
            objectName: opts.objectInfoVisible?.objectName ?? snapshot.project.objectName,
            cityName: opts.objectInfoVisible?.cityName ?? snapshot.project.cityName,
            projectName: snapshot.project.name,
            contactVisible: opts.objectInfoVisible?.contactVisible ?? false,
            // never include sale prices / margins
          } as Prisma.InputJsonValue,
          notificationStatus: "pending",
          lines: {
            create: await Promise.all(
              assignment.estimateLineIds.map(async (lineId) => {
                const raw = lineMap.get(lineId);
                if (!raw) throw new NotFoundError(`Line ${lineId} not in version`);
                const live = await tx.estimateLine.findUnique({
                  where: { id: lineId },
                  select: { id: true },
                });
                return {
                  sourceEstimateLineId: live?.id ?? null,
                  nameSnapshot: String(raw.nameSnapshot ?? ""),
                  unitSnapshot: String(raw.unitSnapshot ?? ""),
                  qty: String(raw.qty ?? "0"),
                };
              }),
            ),
          },
        },
        include: { lines: true },
      });
      out.push(req);
    }
    return out;
  });

  // Notifications after commit — separate state from request creation
  const notifier = getNotificationAdapter();
  for (const req of created) {
    if (req.notificationStatus === "delivered" || req.notificationStatus === "skipped") {
      continue;
    }
    try {
      const result = await notifier.send({
        type: "procurement_request_submitted",
        requestId: req.id,
        toOrganizationId: req.supplierOrganizationId,
        subject: `Новая заявка ${req.id.slice(0, 8)}`,
        body: `Создана заявка с ${req.lines.length} позициями. Оплата вне платформы.`,
      });
      await prisma.procurementRequest.update({
        where: { id: req.id },
        data: {
          notificationStatus: result.ok ? "delivered" : "failed",
          notificationError: result.error ?? null,
          notifiedAt: result.ok ? new Date() : null,
        },
      });
    } catch (e) {
      await prisma.procurementRequest.update({
        where: { id: req.id },
        data: {
          notificationStatus: "failed",
          notificationError: e instanceof Error ? e.message : "notify failed",
        },
      });
    }
  }

  return { requests: created, duplicated: false };
}

export async function listBuyerRequests(userId: string) {
  const ctx = await requireAuthContext(userId, "request:create");
  return prisma.procurementRequest.findMany({
    where: { buyerOrganizationId: ctx.organizationId },
    include: {
      supplierOrganization: true,
      lines: true,
      responses: { orderBy: { version: "desc" }, take: 1 },
      estimateVersion: { select: { id: true, versionNumber: true, estimateId: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listSupplierRequests(userId: string) {
  const ctx = await requireAuthContext(userId, "request:respond");
  return prisma.procurementRequest.findMany({
    where: { supplierOrganizationId: ctx.organizationId },
    include: {
      buyerOrganization: true,
      lines: true,
      responses: { orderBy: { version: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function getRequestForSupplier(userId: string, requestId: string) {
  const ctx = await requireAuthContext(userId, "request:respond");
  const req = await prisma.procurementRequest.findUnique({
    where: { id: requestId },
    include: {
      lines: true,
      responses: { orderBy: { version: "desc" } },
      buyerOrganization: true,
      estimateVersion: true,
    },
  });
  if (!req || req.supplierOrganizationId !== ctx.organizationId) {
    throw new NotFoundError("Request not found");
  }
  return req;
}

async function getRequestForBuyer(userId: string, requestId: string) {
  const ctx = await requireAuthContext(userId, "request:create");
  const req = await prisma.procurementRequest.findUnique({
    where: { id: requestId },
    include: {
      lines: true,
      responses: {
        orderBy: { version: "desc" },
        include: { alternativeCatalogItem: true },
      },
      supplierOrganization: true,
      estimateVersion: { include: { estimate: true } },
    },
  });
  if (!req || req.buyerOrganizationId !== ctx.organizationId) {
    throw new NotFoundError("Request not found");
  }
  return req;
}

/** Supplier view DTO — no sale prices, no competitor lines, no margin. */
export function toSupplierRequestDto(
  req: Awaited<ReturnType<typeof getRequestForSupplier>>,
) {
  return {
    id: req.id,
    status: req.status,
    createdAt: req.createdAt.toISOString(),
    buyerName: req.buyerOrganization.name,
    objectInfo: req.objectInfoVisible,
    lines: req.lines.map((l) => ({
      id: l.id,
      name: l.nameSnapshot,
      unit: l.unitSnapshot,
      qty: l.qty.toString(),
    })),
    responses: req.responses.map((r) => ({
      version: r.version,
      proposedPrice: r.proposedPrice?.toString() ?? null,
      proposedLeadTimeDays: r.proposedLeadTimeDays,
      proposedAvailability: r.proposedAvailability,
      alternativeCatalogItemId: r.alternativeCatalogItemId,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    })),
    disclaimer:
      "Заявка на подтверждение. Оплата и поставка согласуются вне платформы.",
  };
}

export async function markRequestViewed(userId: string, requestId: string) {
  const req = await getRequestForSupplier(userId, requestId);
  if (req.status === "submitted") {
    return prisma.procurementRequest.update({
      where: { id: req.id },
      data: { status: "viewed" },
    });
  }
  return req;
}

export async function respondToRequest(opts: {
  userId: string;
  requestId: string;
  proposedPrice?: string | null;
  proposedLeadTimeDays?: number | null;
  proposedAvailability?: AvailabilityStatus | null;
  alternativeCatalogItemId?: string | null;
  message?: string | null;
  decline?: boolean;
}) {
  const req = await getRequestForSupplier(opts.userId, opts.requestId);
  if (["cancelled", "accepted", "declined"].includes(req.status)) {
    throw new AccessDeniedError("Request is closed");
  }

  const lastVersion = req.responses[0]?.version ?? 0;
  const response = await prisma.$transaction(async (tx) => {
    const r = await tx.supplierResponse.create({
      data: {
        requestId: req.id,
        version: lastVersion + 1,
        proposedPrice: opts.proposedPrice ?? null,
        proposedLeadTimeDays: opts.proposedLeadTimeDays ?? null,
        proposedAvailability: opts.proposedAvailability ?? null,
        alternativeCatalogItemId: opts.alternativeCatalogItemId ?? null,
        message: opts.message ?? null,
      },
    });
    await tx.procurementRequest.update({
      where: { id: req.id },
      data: { status: opts.decline ? "declined" : "responded" },
    });
    return r;
  });

  // Does NOT mutate estimate version
  const notifier = getNotificationAdapter();
  await notifier.send({
    type: "procurement_response_received",
    requestId: req.id,
    toOrganizationId: req.buyerOrganizationId,
    subject: `Ответ по заявке ${req.id.slice(0, 8)}`,
    body: opts.decline
      ? "Поставщик отклонил заявку"
      : `Предложена цена: ${opts.proposedPrice ?? "—"}`,
  });

  return response;
}

/**
 * Buyer accepts supplier response into a NEW draft (does not rewrite issued version).
 * Alternative catalog item requires explicit accept flag.
 */
export async function acceptResponseIntoDraft(opts: {
  userId: string;
  requestId: string;
  responseVersion: number;
  acceptAlternative?: boolean;
}) {
  const ctx = await requireAuthContext(opts.userId, "estimate:write");
  const req = await getRequestForBuyer(opts.userId, opts.requestId);
  const response = req.responses.find((r) => r.version === opts.responseVersion);
  if (!response) throw new NotFoundError("Response not found");

  if (response.alternativeCatalogItemId && !opts.acceptAlternative) {
    throw new AccessDeniedError(
      "Альтернативный товар требует явного принятия (acceptAlternative=true)",
    );
  }

  const draft = await ensureDraftEstimate(opts.userId, req.estimateVersion.estimate.projectId);

  // Apply proposed price to matching draft lines
  for (const line of req.lines) {
    const match = line.sourceEstimateLineId
      ? await prisma.estimateLine.findFirst({
          where: { id: line.sourceEstimateLineId, estimateId: draft.id },
        })
      : await prisma.estimateLine.findFirst({
          where: {
            estimateId: draft.id,
            nameSnapshot: line.nameSnapshot,
            unitSnapshot: line.unitSnapshot,
          },
        });
    if (match && response.proposedPrice != null) {
      await prisma.estimateLine.update({
        where: { id: match.id },
        data: {
          unitPurchasePrice: response.proposedPrice,
          unitSalePrice: response.proposedPrice,
          unknownPriceReason: null,
          priceType: "fixed",
          confirmationStatus: "confirmed",
          sourceLabel: `Ответ поставщика v${response.version} (заявка ${req.id.slice(0, 8)})`,
          sourcedAt: response.createdAt,
          catalogItemId: opts.acceptAlternative
            ? response.alternativeCatalogItemId ?? match.catalogItemId
            : match.catalogItemId,
          manualOverrideReason: response.alternativeCatalogItemId
            ? "Принята альтернатива поставщика — проверить характеристики"
            : null,
        },
      });
    }
  }

  await prisma.procurementRequest.update({
    where: { id: req.id },
    data: { status: "accepted" },
  });

  await prisma.estimate.update({
    where: { id: draft.id },
    data: { draftRevision: { increment: 1 } },
  });

  // Issued version untouched — verify by returning its id
  return {
    draftEstimateId: draft.id,
    projectId: req.estimateVersion.estimate.projectId,
    issuedVersionId: req.estimateVersionId,
    note: "Принятие в портале ≠ оплата и ≠ ЭЦП. Выпущенная версия не изменена.",
    organizationId: ctx.organizationId,
  };
}

export async function getBuyerRequest(userId: string, requestId: string) {
  return getRequestForBuyer(userId, requestId);
}

export async function getSupplierRequest(userId: string, requestId: string) {
  return getRequestForSupplier(userId, requestId);
}

export { AccessDeniedError, NotFoundError, randomUUID };
