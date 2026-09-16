import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  exportVersionDocument,
  ExportRateLimitError,
  ExportTooLargeError,
} from "@/modules/exports/service";
import type { ExportFormat, ExportVariant } from "@/modules/exports/sanitize";
import { AccessDeniedError, NotFoundError } from "@/lib/permissions";
import { contentDispositionAttachment } from "@/modules/exports/http";
import { exportUserMessages } from "@/modules/exports/messages";
import {
  checkPdfBrowserPresent,
  invalidatePdfRuntimeCache,
} from "@/modules/exports/runtime";

export const runtime = "nodejs";
export const maxDuration = 120;

function jsonError(status: number, error: string, requestId: string) {
  return NextResponse.json(
    { error, requestId },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    },
  );
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ versionId: string }> },
) {
  const requestId = req.headers.get("x-request-id") || randomUUID();
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError(401, exportUserMessages.unauthorized, requestId);
  }

  const { versionId } = await ctx.params;
  const format = (req.nextUrl.searchParams.get("format") ?? "pdf") as ExportFormat;
  const variant = (req.nextUrl.searchParams.get("variant") ??
    "client") as ExportVariant;

  if (!["pdf", "xlsx", "docx", "csv"].includes(format)) {
    return jsonError(400, "Неверный формат", requestId);
  }
  if (!["client", "internal"].includes(variant)) {
    return jsonError(400, "Неверный вариант", requestId);
  }

  if (format === "pdf") {
    const pdf = await checkPdfBrowserPresent();
    if (!pdf.ok) {
      return jsonError(503, exportUserMessages.pdfUnavailable, requestId);
    }
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
        "Content-Disposition": contentDispositionAttachment(result.filename),
        "X-Checksum-SHA256": result.checksum,
        "X-Request-Id": requestId,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
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
    console.error(`[export-version ${requestId}]`, e);
    if (format === "pdf") invalidatePdfRuntimeCache();
    return jsonError(
      500,
      format === "pdf" ? exportUserMessages.pdfFailed : exportUserMessages.failed,
      requestId,
    );
  }
}
