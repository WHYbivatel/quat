import { randomUUID } from "node:crypto";

/** Safe internal path only (no open redirect). */
export function safeReturnTo(raw: string | null | undefined, fallback = "/app"): string {
  if (!raw) return fallback;
  const s = String(raw).trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("://")) return fallback;
  if (s.includes("\\") || s.includes("\n") || s.includes("\r")) return fallback;
  return s.slice(0, 500);
}

export function newIdempotencyKey(): string {
  return randomUUID();
}

export function publicErrorRef(): string {
  return Math.floor(Math.random() * 1e10).toString();
}
