import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBuildInfo } from "@/lib/build-info";

export const dynamic = "force-dynamic";

export async function GET() {
  const build = getBuildInfo();

  let schemaVersion: string | null = null;
  let catalogDataVersion: {
    id: string;
    label: string;
    publishedAt: string;
  } | null = null;

  try {
    const migrations = await prisma.$queryRaw<
      Array<{ migration_name: string; finished_at: Date | null }>
    >`SELECT migration_name, finished_at FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`;
    schemaVersion = migrations[0]?.migration_name ?? null;
  } catch {
    schemaVersion = null;
  }

  try {
    const latest = await prisma.catalogDataVersion.findFirst({
      orderBy: { publishedAt: "desc" },
      select: { id: true, label: true, publishedAt: true },
    });
    if (latest) {
      catalogDataVersion = {
        id: latest.id,
        label: latest.label,
        publishedAt: latest.publishedAt.toISOString(),
      };
    }
  } catch {
    catalogDataVersion = null;
  }

  return NextResponse.json(
    {
      appVersion: build.version,
      gitSha: build.gitShaShort,
      buildTime: build.buildTime,
      deploymentId: build.deploymentId,
      calculationPolicyVersion: "commercial-v1",
      schemaVersion,
      catalogDataVersion,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
