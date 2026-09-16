import { NextResponse } from "next/server";
import {
  FeatureUnavailableError,
  assertFeatureActionable,
} from "@/modules/features/assert";
import type { FeatureId } from "@/modules/features/registry";

/**
 * Probe endpoint: COMING_SOON / UNAVAILABLE features must not mutate.
 * POST { featureId } → 403 with featureId when not actionable.
 */
export async function POST(req: Request) {
  let featureId: FeatureId | undefined;
  try {
    const body = (await req.json()) as { featureId?: string };
    featureId = body.featureId as FeatureId | undefined;
    if (!featureId) {
      return NextResponse.json({ error: "featureId required" }, { status: 400 });
    }
    assertFeatureActionable(featureId);
    return NextResponse.json({
      ok: true,
      featureId,
      message: "Функция доступна (probe, без побочных эффектов).",
    });
  } catch (e) {
    if (e instanceof FeatureUnavailableError) {
      return NextResponse.json(
        {
          error: e.message,
          featureId: e.featureId,
          status: "unavailable",
        },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: "Unknown feature" }, { status: 400 });
  }
}
