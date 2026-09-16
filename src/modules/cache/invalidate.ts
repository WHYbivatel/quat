import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { prisma } from "@/lib/db";
import type { CacheInvalidationPayload } from "./tags";

export type InvalidateMode = "action" | "background";

function unique(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).filter(Boolean))];
}

async function enqueueJob(payload: CacheInvalidationPayload, error: unknown) {
  const message =
    error instanceof Error ? error.message.slice(0, 500) : "revalidate failed";
  await prisma.cacheInvalidationJob.create({
    data: {
      tags: unique(payload.tags),
      paths: unique(payload.paths),
      status: "pending",
      attempts: 0,
      lastError: message,
    },
  });
}

function applyTags(tags: string[], mode: InvalidateMode) {
  for (const tag of tags) {
    if (mode === "action") {
      updateTag(tag);
    } else {
      revalidateTag(tag, "max");
    }
  }
}

function applyPaths(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

/**
 * Invalidate after DB commit. On failure, enqueue CacheInvalidationJob.
 * Prefer mode "action" inside Server Actions (updateTag = read-your-own-writes).
 */
export async function invalidateCache(
  payload: CacheInvalidationPayload,
  mode: InvalidateMode = "action",
): Promise<{ ok: boolean; queued?: boolean }> {
  const tags = unique(payload.tags);
  const paths = unique(payload.paths);
  if (tags.length === 0 && paths.length === 0) return { ok: true };

  try {
    applyTags(tags, mode);
    applyPaths(paths);
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    // Outside a Next request (seed/scripts/tests) there is no incremental cache.
    const outsideNext =
      message.includes("static generation store missing") ||
      message.includes("incremental cache");
    if (outsideNext) {
      try {
        await enqueueJob({ tags, paths }, error);
        return { ok: false, queued: true };
      } catch {
        return { ok: false, queued: false };
      }
    }
    try {
      await enqueueJob({ tags, paths }, error);
      return { ok: false, queued: true };
    } catch {
      console.error("[cache] invalidate failed and outbox write failed", error);
      return { ok: false, queued: false };
    }
  }
}

export async function processPendingInvalidations(limit = 20): Promise<{
  processed: number;
  failed: number;
}> {
  const jobs = await prisma.cacheInvalidationJob.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let processed = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      applyTags(job.tags, "background");
      applyPaths(job.paths);
      await prisma.cacheInvalidationJob.update({
        where: { id: job.id },
        data: {
          status: "done",
          attempts: job.attempts + 1,
          processedAt: new Date(),
          lastError: null,
        },
      });
      processed += 1;
    } catch (error) {
      failed += 1;
      const message =
        error instanceof Error ? error.message.slice(0, 500) : "retry failed";
      await prisma.cacheInvalidationJob.update({
        where: { id: job.id },
        data: {
          status: job.attempts + 1 >= 10 ? "failed" : "pending",
          attempts: job.attempts + 1,
          lastError: message,
        },
      });
    }
  }

  return { processed, failed };
}
