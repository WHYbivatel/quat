import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { publishCuratedPublicSources } from "@/modules/sources/publish";

const prisma = new PrismaClient();

describe("public sources publish", () => {
  beforeAll(async () => {
    // Ensure units/cities from seed exist; if empty, skip heavy setup
    const units = await prisma.unit.count();
    if (units === 0) {
      throw new Error("Run seed before this test (units required)");
    }
  });

  it("publishes curated listings idempotently without touching estimate versions", async () => {
    const versionsBefore = await prisma.estimateVersion.count();
    const first = await publishCuratedPublicSources({ actorUserId: "test" });
    const count1 = await prisma.publicPriceListing.count({
      where: { lifecycle: "published" },
    });
    expect(count1).toBeGreaterThanOrEqual(40);

    const second = await publishCuratedPublicSources({ actorUserId: "test" });
    const count2 = await prisma.publicPriceListing.count({
      where: { lifecycle: "published" },
    });
    expect(count2).toBe(count1);
    expect(second.added).toBe(0);

    const versionsAfter = await prisma.estimateVersion.count();
    expect(versionsAfter).toBe(versionsBefore);

    const etlOnRequest = await prisma.publicPriceListing.count({
      where: {
        sourceProvider: { code: "etl-xxi" },
        priceType: "on_request",
        lifecycle: "published",
      },
    });
    expect(etlOnRequest).toBeGreaterThanOrEqual(1);
    expect(first.versionId).toBeTruthy();
  });
});
