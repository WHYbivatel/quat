import { NextResponse } from "next/server";
import { getBuildInfo } from "@/lib/build-info";

export const dynamic = "force-dynamic";

export async function GET() {
  const build = getBuildInfo();
  return NextResponse.json(
    { status: "ok", deploymentId: build.deploymentId },
    { headers: { "Cache-Control": "no-store" } },
  );
}
