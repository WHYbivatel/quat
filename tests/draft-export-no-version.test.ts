import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { addCatalogItemToDraft } from "@/modules/estimates/draft";
import { exportDraftDocument } from "@/modules/exports/service";
import { issueEstimateVersion } from "@/modules/estimates/versions";

const prisma = new PrismaClient();

describe("draft PDF without issuing version", () => {
  let userId: string;
  let estimateId: string;
  let revision: number;

  beforeAll(async () => {
    await prisma.exportArtifact.deleteMany({
      where: { createdBy: { email: "test-draft-pdf@quathub.local" } },
    });
    await prisma.project.deleteMany({ where: { name: "[TEST] DraftPDF" } });
    await prisma.membership.deleteMany({
      where: { user: { email: "test-draft-pdf@quathub.local" } },
    });
    await prisma.userSession.deleteMany({
      where: { user: { email: "test-draft-pdf@quathub.local" } },
    });
    await prisma.user.deleteMany({
      where: { email: "test-draft-pdf@quathub.local" },
    });
    await prisma.organization.deleteMany({
      where: { name: "[TEST] DraftPDF Org" },
    });

    const passwordHash = await hash("Test1234!", 10);
    const org = await prisma.organization.create({
      data: { name: "[TEST] DraftPDF Org", type: "buyer", isDemo: true },
    });
    const user = await prisma.user.create({
      data: {
        email: "test-draft-pdf@quathub.local",
        passwordHash,
        memberships: { create: { organizationId: org.id, role: "estimator" } },
        activeOrgSessions: { create: { activeOrganizationId: org.id } },
      },
    });
    userId = user.id;
    const project = await prisma.project.create({
      data: { organizationId: org.id, name: "[TEST] DraftPDF" },
    });
    const item = await prisma.catalogItem.findFirstOrThrow({
      where: { kind: "product", status: "active" },
    });
    const added = await addCatalogItemToDraft({
      userId,
      projectId: project.id,
      catalogItemId: item.id,
      qty: "2",
    });
    estimateId = added.estimateId;
    const est = await prisma.estimate.findUniqueOrThrow({ where: { id: estimateId } });
    revision = est.draftRevision;
  });

  it("exports PDF without creating EstimateVersion or bumping revision", async () => {
    const beforeVersions = await prisma.estimateVersion.count({
      where: { estimateId },
    });
    const result = await exportDraftDocument({
      userId,
      estimateId,
      expectedRevision: revision,
      format: "pdf",
      variant: "client",
    });
    expect(result.contentType).toBe("application/pdf");
    expect(result.buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(result.model.preliminary).toBe(true);
    expect(result.model.versionLabel).toContain(`r${revision}`);
    expect(JSON.stringify(result.model)).not.toMatch(/secret-note|unitPurchasePrice/i);

    const afterVersions = await prisma.estimateVersion.count({
      where: { estimateId },
    });
    expect(afterVersions).toBe(beforeVersions);

    const est = await prisma.estimate.findUniqueOrThrow({ where: { id: estimateId } });
    expect(est.draftRevision).toBe(revision);
  });

  it("issue version after draft PDF still works with same revision", async () => {
    const issued = await issueEstimateVersion({
      userId,
      estimateId,
      expectedRevision: revision,
      allowPreliminary: true,
      idempotencyKey: `test-issue-${estimateId}-${revision}`,
    });
    expect(issued.version.id).toBeTruthy();
    const again = await issueEstimateVersion({
      userId,
      estimateId,
      expectedRevision: revision,
      allowPreliminary: true,
      idempotencyKey: `test-issue-${estimateId}-${revision}`,
    });
    expect(again.version.id).toBe(issued.version.id);
    expect(again.replayed).toBe(true);
  });
});
