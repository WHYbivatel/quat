import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/modules/organizations/access";
import { NotFoundError } from "@/lib/permissions";
import { writeAudit } from "./audit";

export async function listOrganizationsAdmin(userId: string) {
  await requirePlatformAdmin(userId);
  return prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: {
      verifications: { orderBy: { createdAt: "desc" }, take: 3 },
      _count: { select: { offers: true, memberships: true } },
    },
  });
}

export async function addOrganizationVerification(opts: {
  userId: string;
  organizationId: string;
  kind: string;
  source: string;
  verifiedAt: Date;
  isVerified: boolean;
  documentName?: string | null;
  notes?: string | null;
}) {
  await requirePlatformAdmin(opts.userId);
  const org = await prisma.organization.findUnique({
    where: { id: opts.organizationId },
  });
  if (!org) throw new NotFoundError("Organization not found");

  // Uploaded file alone must not imply verified licence.
  const isVerified = opts.isVerified && Boolean(opts.source?.trim());

  const row = await prisma.organizationVerification.create({
    data: {
      organizationId: opts.organizationId,
      kind: opts.kind,
      source: opts.source.trim(),
      verifiedAt: opts.verifiedAt,
      isVerified,
      documentName: opts.documentName ?? null,
      notes: opts.notes ?? null,
      createdById: opts.userId,
    },
  });
  await writeAudit({
    actorUserId: opts.userId,
    organizationId: opts.organizationId,
    entityType: "OrganizationVerification",
    entityId: row.id,
    action: "create",
    after: row,
  });
  return row;
}

export async function setOrganizationStatus(
  userId: string,
  organizationId: string,
  status: "active" | "suspended",
) {
  await requirePlatformAdmin(userId);
  const before = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!before) throw new NotFoundError("Organization not found");
  const after = await prisma.organization.update({
    where: { id: organizationId },
    data: { status },
  });
  await writeAudit({
    actorUserId: userId,
    organizationId,
    entityType: "Organization",
    entityId: organizationId,
    action: "status_change",
    before,
    after,
  });
  return after;
}
