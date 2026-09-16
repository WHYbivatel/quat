import { access } from "fs/promises";
import { constants } from "fs";
import path from "path";

export type PdfRuntimeStatus = {
  ok: boolean;
  reason?: "missing_browser" | "launch_failed";
};

let cached: { at: number; status: PdfRuntimeStatus } | null = null;
const TTL_MS = 60_000;

function browserRoots(): string[] {
  const env = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const roots: string[] = [];
  if (env) roots.push(env);
  roots.push(path.join(process.cwd(), "node_modules", "playwright-core", ".local-browsers"));
  return roots;
}

/** Cheap check: Chromium binary present and readable (no launch). */
export async function checkPdfBrowserPresent(): Promise<PdfRuntimeStatus> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.status;
  try {
    const { chromium } = await import("playwright");
    const exe = chromium.executablePath();
    await access(exe, constants.X_OK);
    cached = { at: Date.now(), status: { ok: true } };
    return cached.status;
  } catch {
    // Fall back to scanning known roots
    for (const root of browserRoots()) {
      try {
        const { readdir } = await import("fs/promises");
        const entries = await readdir(root, { withFileTypes: true });
        const chromeDir = entries.find(
          (e) => e.isDirectory() && e.name.startsWith("chromium"),
        );
        if (chromeDir) {
          cached = { at: Date.now(), status: { ok: true } };
          return cached.status;
        }
      } catch {
        /* continue */
      }
    }
    const status: PdfRuntimeStatus = { ok: false, reason: "missing_browser" };
    cached = { at: Date.now(), status };
    return status;
  }
}

/** Invalidate cache after admin probe or failed render. */
export function invalidatePdfRuntimeCache(): void {
  cached = null;
}
