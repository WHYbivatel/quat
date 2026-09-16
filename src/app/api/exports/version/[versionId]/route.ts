import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  exportVersionDocument,
  ExportRateLimitError,
  ExportTooLargeError,
} from "@/modules/exports/service";
import type { ExportFormat, ExportVariant } from "@/modules/exports/sanitize";
import { AccessDeniedError, NotFoundError } from "@/lib/permissions";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ versionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { versionId } = await ctx.params;
  const format = (req.nextUrl.searchParams.get("format") ?? "pdf") as ExportFormat;
  const variant = (req.nextUrl.searchParams.get("variant") ?? "client") as ExportVariant;

  if (!["pdf", "xlsx", "docx", "csv"].includes(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }
  if (!["client", "internal"].includes(variant)) {
    return NextResponse.json({ error: "Invalid variant" }, { status: 400 });
  }

  try {
    const result = await exportVersionDocument({
      userId: session.user.id,
      versionId,
      format,
      variant,
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "X-Checksum-SHA256": result.checksum,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ExportRateLimitError) {
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    if (e instanceof ExportTooLargeError) {
      return NextResponse.json({ error: e.message }, { status: 413 });
    }
    if (e instanceof AccessDeniedError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof NotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    console.error(e);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
