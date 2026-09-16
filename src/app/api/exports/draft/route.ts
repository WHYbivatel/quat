import { randomUUID } from "crypto";
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
import { contentDispositionAttachment } from "@/modules/exports/http";
import { exportUserMessages } from "@/modules/exports/messages";
import {
  checkPdfBrowserPresent,
  invalidatePdfRuntimeCache,
} from "@/modules/exports/runtime";

export const runtime = "nodejs";
export const maxDuration = 120;

function jsonError(
  status: number,
  error: string,
  requestId: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { error, requestId, ...extra },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    },
  );
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || randomUUID();
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError(401, exportUserMessages.unauthorized, requestId);
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
    return jsonError(400, "Не указаны estimateId или revision", requestId);
  }

  if (format === "pdf") {
    const pdf = await checkPdfBrowserPresent();
    if (!pdf.ok) {
      return jsonError(503, exportUserMessages.pdfUnavailable, requestId, {
        featureId: "estimate.export_draft_pdf",
      });
    }
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
        "Content-Disposition": contentDispositionAttachment(result.filename),
        "X-Checksum-SHA256": result.checksum,
        "X-Request-Id": requestId,
        "X-Draft-Revision": String(result.draftRevision),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof ConflictError || e instanceof VersionBlockedError) {
      return jsonError(409, e.message, requestId);
    }
    if (e instanceof ExportRateLimitError) {
      return jsonError(429, e.message, requestId);
    }
    if (e instanceof ExportTooLargeError) {
      return jsonError(413, e.message, requestId);
    }
    if (e instanceof AccessDeniedError) {
      return jsonError(403, e.message, requestId);
    }
    if (e instanceof NotFoundError) {
      return jsonError(404, e.message, requestId);
    }
    console.error(`[export-draft ${requestId}]`, e);
    if (format === "pdf") invalidatePdfRuntimeCache();
    return jsonError(
      500,
      format === "pdf" ? exportUserMessages.pdfFailed : exportUserMessages.failed,
      requestId,
    );
  }
}
