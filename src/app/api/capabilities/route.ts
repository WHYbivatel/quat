import { NextResponse } from "next/server";
import { publicFeatureSummary } from "@/modules/features/registry";

/** Public safe feature matrix — no secrets, no env internals. */
export async function GET() {
  return NextResponse.json({ features: publicFeatureSummary() });
}
