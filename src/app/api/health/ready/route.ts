import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBuildInfo } from "@/lib/build-info";

export const dynamic = "force-dynamic";

export async function GET() {
  const build = getBuildInfo();
  const started = Date.now();

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("db timeout")), 1500),
      ),
    ]);
  } catch {
    return NextResponse.json(
      {
        status: "not_ready",
        deploymentId: build.deploymentId,
        checks: { database: "fail" },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      status: "ready",
      deploymentId: build.deploymentId,
      checks: { database: "ok" },
      latencyMs: Date.now() - started,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
