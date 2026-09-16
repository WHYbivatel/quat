import { describe, expect, it, beforeEach } from "vitest";
import {
  assertRateLimit,
  RateLimitError,
  resetRateLimits,
} from "@/lib/rate-limit";

describe("rate-limit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to limit then throws", () => {
    for (let i = 0; i < 3; i++) {
      assertRateLimit({ key: "t", limit: 3 });
    }
    expect(() => assertRateLimit({ key: "t", limit: 3 })).toThrow(RateLimitError);
  });

  it("isolates keys", () => {
    assertRateLimit({ key: "a", limit: 1 });
    expect(() => assertRateLimit({ key: "a", limit: 1 })).toThrow(RateLimitError);
    expect(() => assertRateLimit({ key: "b", limit: 1 })).not.toThrow();
  });
});
