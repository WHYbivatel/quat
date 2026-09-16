-- CreateTable
CREATE TABLE "cache_invalidation_jobs" (
    "id" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "paths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),

    CONSTRAINT "cache_invalidation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cache_invalidation_jobs_status_createdAt_idx" ON "cache_invalidation_jobs"("status", "createdAt");
