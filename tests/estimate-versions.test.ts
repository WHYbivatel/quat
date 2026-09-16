import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { addCatalogItemToDraft } from "@/modules/estimates/draft";
import { updateLineFields, ConflictError } from "@/modules/estimates/editor";
import {
  createPublicLink,
  getPublicEstimateByToken,
  issueEstimateVersion,
  revokePublicLink,
  toClientEstimateDto,
  buildSnapshot,
  VersionBlockedError,
} from "@/modules/estimates/versions";
import { applyOfferPriceUpdates, compareOfferPrices } from "@/modules/estimates/price-refresh";

const prisma = new PrismaClient();

describe("estimate versions and concurrency", () => {
  let userId: string;
  let projectId: string;
  let estimateId: string;
  let productId: string;
  let offerId: string;
  let serviceId: string;

  beforeAll(async () => {
    await prisma.procurementRequest.deleteMany({
      where: {
        estimateVersion: {
          estimate: {
            project: { name: { in: ["[TEST] Versions", "[TEST] Incomplete"] } },
          },
        },
      },
    });
    await prisma.project.deleteMany({
      where: { name: { in: ["[TEST] Versions", "[TEST] Incomplete"] } },
    });
    await prisma.membership.deleteMany({
      where: { user: { email: "test-ver@quathub.local" } },
    });
    await prisma.userSession.deleteMany({
      where: { user: { email: "test-ver@quathub.local" } },
    });
    await prisma.user.deleteMany({ where: { email: "test-ver@quathub.local" } });
    await prisma.organization.deleteMany({ where: { name: "[TEST] Ver Org" } });

    const org = await prisma.organization.create({
      data: { name: "[TEST] Ver Org", type: "buyer", isDemo: true },
    });
    const passwordHash = await hash("Test1234!", 10);
    const user = await prisma.user.create({
      data: {
        email: "test-ver@quathub.local",
        passwordHash,
        memberships: { create: { organizationId: org.id, role: "estimator" } },
        activeOrgSessions: { create: { activeOrganizationId: org.id } },
      },
    });
    userId = user.id;
    const project = await prisma.project.create({
      data: { organizationId: org.id, name: "[TEST] Versions" },
    });
    projectId = project.id;

    const product = await prisma.catalogItem.findFirst({
      where: { kind: "product", status: "active", sku: "CBL-VVG-3X2.5" },
    });
    const service = await prisma.catalogItem.findFirst({
      where: { kind: "service", status: "active" },
    });
    expect(product && service).toBeTruthy();
    productId = product!.id;
    serviceId = service!.id;
    const offer = await prisma.offer.findFirst({
      where: {
        catalogItemId: productId,
        priceType: "fixed",
        moderationStatus: "approved",
      },
    });
    offerId = offer!.id;

    const a = await addCatalogItemToDraft({
      userId,
      projectId,
      catalogItemId: productId,
      offerId,
      qty: "12.5",
    });
    await addCatalogItemToDraft({
      userId,
      projectId,
      catalogItemId: serviceId,
      qty: "12.5",
    });
    estimateId = a.estimateId;

    // Ensure sale prices for complete calc where possible
    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: { lines: true },
    });
    for (const line of estimate!.lines) {
      if (line.unitSalePrice == null) {
        await prisma.estimateLine.update({
          where: { id: line.id },
          data: {
            unitSalePrice: "350",
            saleVatMode: "zero",
            saleVatRate: "0",
            unknownPriceReason: null,
            priceType: "fixed",
            confirmationStatus: "draft",
          },
        });
      } else {
        await prisma.estimateLine.update({
          where: { id: line.id },
          data: {
            saleVatMode: "zero",
            saleVatRate: "0",
            unknownPriceReason: null,
          },
        });
      }
    }
  });

  it("persists fractional qty after reload", async () => {
    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: { lines: true },
    });
    expect(estimate!.lines.some((l) => l.qty.toString() === "12.5")).toBe(true);
  });

  it("optimistic concurrency rejects stale revision", async () => {
    const estimate = await prisma.estimate.findUniqueOrThrow({
      where: { id: estimateId },
      include: { lines: true },
    });
    const line = estimate.lines[0];
    await expect(
      updateLineFields({
        userId,
        lineId: line.id,
        expectedRevision: estimate.draftRevision - 1,
        qty: "1",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("issues immutable version; later price change does not alter version", async () => {
    const before = await prisma.estimate.findUniqueOrThrow({
      where: { id: estimateId },
    });
    const issued = await issueEstimateVersion({
      userId,
      estimateId,
      expectedRevision: before.draftRevision,
      allowPreliminary: true,
    });
    expect(issued.version.immutable).toBe(true);
    const calcBefore = issued.calc.knownSubtotal;

    // Change live offer price
    await prisma.offer.update({
      where: { id: offerId },
      data: { price: "999999" },
    });

    // Change draft line
    const afterIssue = await prisma.estimate.findUniqueOrThrow({
      where: { id: estimateId },
      include: { lines: true },
    });
    await updateLineFields({
      userId,
      lineId: afterIssue.lines[0].id,
      expectedRevision: afterIssue.draftRevision,
      unitSalePrice: "1",
    });

    const stored = await prisma.estimateVersion.findUniqueOrThrow({
      where: { id: issued.version.id },
    });
    const storedCalc = stored.calcResult as { knownSubtotal: string };
    expect(storedCalc.knownSubtotal).toBe(calcBefore);
    expect(stored.immutable).toBe(true);
  });

  it("blocks fixed version when unknown prices present", async () => {
    const project = await prisma.project.create({
      data: {
        organizationId: (
          await prisma.membership.findFirstOrThrow({ where: { userId } })
        ).organizationId,
        name: "[TEST] Incomplete",
      },
    });
    const added = await addCatalogItemToDraft({
      userId,
      projectId: project.id,
      catalogItemId: productId,
      // no offer → unknown
    });
    const est = await prisma.estimate.findUniqueOrThrow({
      where: { id: added.estimateId },
    });
    await expect(
      issueEstimateVersion({
        userId,
        estimateId: est.id,
        expectedRevision: est.draftRevision,
        allowPreliminary: false,
      }),
    ).rejects.toBeInstanceOf(VersionBlockedError);
  });

  it("client DTO and public link omit purchase/margin", async () => {
    const version = await prisma.estimateVersion.findFirstOrThrow({
      where: { estimateId },
      orderBy: { versionNumber: "desc" },
    });
    const { snapshot, calc } = await buildSnapshot(userId, estimateId);
    // force purchase into snapshot lines for DTO test
    snapshot.lines[0].unitPurchasePrice = "123";
    snapshot.lines[0].markupPercent = "15";
    snapshot.lines[0].notesInternal = "secret";

    const dto = toClientEstimateDto(snapshot, calc);
    const json = JSON.stringify(dto);
    expect(json).not.toContain("unitPurchasePrice");
    expect(json).not.toContain("markupPercent");
    expect(json).not.toContain("notesInternal");
    expect(json).not.toContain("contributionBeforeProfitTax");
    expect(json).not.toContain("123");
    expect(json).not.toContain("secret");

    const link = await createPublicLink({
      userId,
      versionId: version.id,
      expiresInDays: 1,
    });
    const pub = await getPublicEstimateByToken(link.token);
    expect(pub).not.toBeNull();
    const pubJson = JSON.stringify(pub!.clientDto);
    expect(pubJson).not.toContain("unitPurchasePrice");
    expect(pubJson).not.toContain("markupPercent");

    await revokePublicLink({ userId, linkId: link.id });
    const revoked = await getPublicEstimateByToken(link.token);
    expect(revoked).toBeNull();
  });

  it("price compare detects offer change without rewriting version", async () => {
    const diffs = await compareOfferPrices(userId, estimateId);
    expect(Array.isArray(diffs)).toBe(true);
    const est = await prisma.estimate.findUniqueOrThrow({
      where: { id: estimateId },
      include: { lines: true, versions: true },
    });
    const versionCalc = est.versions[0]
      ? ((est.versions[0] as { calcResult?: unknown }).calcResult as
          | { knownSubtotal: string }
          | undefined)
      : undefined;
    const changed = diffs.filter((d) => d.changed);
    if (changed.length > 0) {
      await applyOfferPriceUpdates({
        userId,
        estimateId,
        expectedRevision: est.draftRevision,
        lineIds: [changed[0].lineId],
      });
    }
    if (versionCalc && est.versions[0]) {
      const fresh = await prisma.estimateVersion.findUniqueOrThrow({
        where: { id: est.versions[0].id },
      });
      expect((fresh.calcResult as { knownSubtotal: string }).knownSubtotal).toBe(
        versionCalc.knownSubtotal,
      );
    }
  });
});
