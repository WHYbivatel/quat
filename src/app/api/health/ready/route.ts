import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBuildInfo } from "@/lib/build-info";
import { checkPdfBrowserPresent } from "@/modules/exports/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const build = getBuildInfo();
  const started = Date.now();

  let dbOk = false;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("db timeout")), 1500),
      ),
    ]);
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const pdf = await checkPdfBrowserPresent();
  const checks = {
    database: dbOk ? "ok" : "fail",
    pdf: pdf.ok ? "ok" : "fail",
  };

  if (!dbOk) {
    return NextResponse.json(
      {
        status: "not_ready",
        deploymentId: build.deploymentId,
        checks,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      status: "ready",
      deploymentId: build.deploymentId,
      checks,
      latencyMs: Date.now() - started,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
