import { prisma } from "@/lib/db";

const SECRET_KEYS = /password|hash|token|secret|credential/i;

export function stripSecrets(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripSecrets);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEYS.test(k)) continue;
    out[k] = stripSecrets(v);
  }
  return out;
}

export async function writeAudit(opts: {
  actorUserId?: string | null;
  organizationId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}) {
  return prisma.auditEvent.create({
    data: {
      actorUserId: opts.actorUserId ?? null,
      organizationId: opts.organizationId ?? null,
      entityType: opts.entityType,
      entityId: opts.entityId,
      action: opts.action,
      before: opts.before == null ? undefined : (stripSecrets(opts.before) as object),
      after: opts.after == null ? undefined : (stripSecrets(opts.after) as object),
    },
  });
}

export async function listAuditEvents(opts: {
  organizationId?: string;
  entityType?: string;
  limit?: number;
}) {
  return prisma.auditEvent.findMany({
    where: {
      organizationId: opts.organizationId,
      entityType: opts.entityType,
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
    include: {
      actor: { select: { id: true, email: true, name: true } },
    },
  });
}
