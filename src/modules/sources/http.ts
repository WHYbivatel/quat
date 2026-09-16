import { createHash } from "node:crypto";

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|\[::1\]|0\.0\.0\.0)/i;

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

export type SafeFetchOptions = {
  url: string;
  allowlistDomains: string[];
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
  etag?: string | null;
  lastModified?: string | null;
};

export async function safeFetchText(opts: SafeFetchOptions): Promise<{
  body: string;
  etag: string | null;
  lastModified: string | null;
  status: number;
}> {
  const url = new URL(opts.url);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new SsrfBlockedError("Only http(s) allowed");
  }
  if (PRIVATE_HOST.test(url.hostname)) {
    throw new SsrfBlockedError("Private/localhost host blocked");
  }
  const host = url.hostname.toLowerCase();
  if (!opts.allowlistDomains.some((d) => host === d || host.endsWith(`.${d}`))) {
    throw new SsrfBlockedError(`Domain not allowlisted: ${host}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    const headers: Record<string, string> = {
      "User-Agent":
        opts.userAgent ??
        "QuatHubBot/0.1 (+https://quat.esl.kz; contact=admin@demo.quathub.local)",
      Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
    };
    if (opts.etag) headers["If-None-Match"] = opts.etag;
    if (opts.lastModified) headers["If-Modified-Since"] = opts.lastModified;

    const res = await fetch(url.toString(), {
      method: "GET",
      headers,
      redirect: "manual",
      signal: controller.signal,
    });

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) throw new SsrfBlockedError("Redirect without location");
      const next = new URL(loc, url);
      if (PRIVATE_HOST.test(next.hostname)) {
        throw new SsrfBlockedError("Redirect to private host blocked");
      }
      const nextHost = next.hostname.toLowerCase();
      if (
        !opts.allowlistDomains.some(
          (d) => nextHost === d || nextHost.endsWith(`.${d}`),
        )
      ) {
        throw new SsrfBlockedError(`Redirect domain not allowlisted: ${nextHost}`);
      }
      // one hop only
      return safeFetchText({ ...opts, url: next.toString(), etag: null, lastModified: null });
    }

    const max = opts.maxBytes ?? 1_500_000;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > max) throw new Error(`Response too large: ${buf.byteLength}`);
    return {
      body: buf.toString("utf8"),
      etag: res.headers.get("etag"),
      lastModified: res.headers.get("last-modified"),
      status: res.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function fingerprint(parts: Record<string, string | null | undefined>) {
  const payload = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k] ?? ""}`)
    .join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export function parsePublicPriceLabel(raw: string): {
  priceType: "fixed" | "from" | "range" | "on_request";
  price: string | null;
  priceMin: string | null;
  priceMax: string | null;
} {
  const s = raw.replace(/\u00a0/g, " ").trim().toLowerCase();
  if (!s || /уточнить|по запросу|договор/.test(s)) {
    return { priceType: "on_request", price: null, priceMin: null, priceMax: null };
  }
  const from = s.match(/от\s*([\d\s]+)/);
  if (from) {
    return {
      priceType: "from",
      price: null,
      priceMin: from[1].replace(/\s/g, ""),
      priceMax: null,
    };
  }
  const range = s.match(/([\d\s]+)\s*[-–—]\s*([\d\s]+)/);
  if (range) {
    return {
      priceType: "range",
      price: null,
      priceMin: range[1].replace(/\s/g, ""),
      priceMax: range[2].replace(/\s/g, ""),
    };
  }
  const num = s.match(/([\d\s]+)/);
  if (num) {
    const n = num[1].replace(/\s/g, "");
    return { priceType: "fixed", price: n, priceMin: null, priceMax: null };
  }
  return { priceType: "on_request", price: null, priceMin: null, priceMax: null };
}

export type NormalizedListing = {
  sourceRecordKey: string;
  name: string;
  unitCode: string;
  unitLabelRaw: string;
  priceType: "fixed" | "from" | "range" | "on_request";
  price: string | null;
  priceMin: string | null;
  priceMax: string | null;
  taxStatus: "unknown" | "with_vat" | "without_vat" | "not_specified";
  requiresInspection: boolean;
  contentHash: string;
};

export interface SourceAdapter {
  code: string;
  allowlistDomains: string[];
  parserVersion: string;
  fetch?(): Promise<string>;
  parse(raw: string): unknown[];
  normalize(rows: unknown[]): NormalizedListing[];
  validate(rows: NormalizedListing[]): { ok: boolean; errors: string[] };
  fingerprint(row: NormalizedListing): string;
}
