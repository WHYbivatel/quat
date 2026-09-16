import { describe, expect, it, vi, beforeEach } from "vitest";
import { cacheTags } from "@/modules/cache/tags";

describe("cacheTags", () => {
  it("never embeds raw share tokens", () => {
    const linkId = "clxxxxxxxx";
    expect(cacheTags.publicEstimate(linkId)).toBe(`public-estimate:${linkId}`);
    expect(cacheTags.publicEstimate(linkId)).not.toMatch(/token/);
  });

  it("builds scoped catalog tags", () => {
    expect(cacheTags.catalog).toBe("catalog");
    expect(cacheTags.item("a")).toBe("item:a");
    expect(cacheTags.organizationProjects("org1")).toBe(
      "organization-projects:org1",
    );
  });
});

describe("invalidateCache outbox", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("enqueues CacheInvalidationJob when revalidate throws", async () => {
    vi.doMock("next/cache", () => ({
      updateTag: () => {
        throw new Error("no incremental cache");
      },
      revalidateTag: () => {
        throw new Error("no incremental cache");
      },
      revalidatePath: () => {
        throw new Error("no incremental cache");
      },
    }));

    const create = vi.fn().mockResolvedValue({ id: "job1" });
    vi.doMock("@/lib/db", () => ({
      prisma: {
        cacheInvalidationJob: { create },
      },
    }));

    const { invalidateCache } = await import("@/modules/cache/invalidate");
    const result = await invalidateCache(
      { tags: [cacheTags.catalog], paths: ["/catalog/services"] },
      "action",
    );

    expect(result.ok).toBe(false);
    expect(result.queued).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tags: ["catalog"],
          paths: ["/catalog/services"],
          status: "pending",
        }),
      }),
    );
  });
});
