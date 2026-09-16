export class RateLimitError extends Error {
  constructor(message = "Слишком много запросов. Подождите минуту.") {
    super(message);
    this.name = "RateLimitError";
  }
}

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * In-memory sliding window counter. Fine for single-instance staging;
 * replace with Redis for multi-instance production.
 */
export function assertRateLimit(opts: {
  key: string;
  limit: number;
  windowMs?: number;
  message?: string;
}): void {
  const windowMs = opts.windowMs ?? 60_000;
  const now = Date.now();
  const cur = buckets.get(opts.key);
  if (!cur || cur.resetAt < now) {
    buckets.set(opts.key, { count: 1, resetAt: now + windowMs });
    return;
  }
  cur.count += 1;
  if (cur.count > opts.limit) {
    throw new RateLimitError(opts.message);
  }
}

/** Test helper */
export function resetRateLimits() {
  buckets.clear();
}
