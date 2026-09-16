import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  exportDraftDocument,
  ExportRateLimitError,
  ExportTooLargeError,
} from "@/modules/exports/service";
import type { ExportFormat, ExportVariant } from "@/modules/exports/sanitize";
import { AccessDeniedError, NotFoundError } from "@/lib/permissions";
import {
  ConflictError,
  VersionBlockedError,
} from "@/modules/estimates/versions";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    estimateId?: string;
    expectedRevision?: number;
    format?: ExportFormat;
    variant?: ExportVariant;
  };

  const format = body.format ?? "pdf";
  const variant = body.variant ?? "client";
  if (!body.estimateId || body.expectedRevision == null) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const result = await exportDraftDocument({
      userId: session.user.id,
      estimateId: body.estimateId,
      expectedRevision: body.expectedRevision,
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
    if (e instanceof ConflictError || e instanceof VersionBlockedError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
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
