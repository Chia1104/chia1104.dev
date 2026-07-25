import type { Keyv } from "@chia/kv";

import { AppError } from "../errors";

import type { Policy } from "./types";
import { allow, deny } from "./types";

interface RateLimitEntry {
  totalHits: number;
  resetTime: number;
}

export interface RateLimitPolicyOptions {
  windowMs: number;
  limit: number;
  /**
   * Namespaces the counter, so each route family gets its own budget.
   * @default "rate-limiter:root-request"
   */
  prefix?: string;
  /**
   * Derives the counter key from the context. Defaults to the client IP.
   */
  keyGenerator?: (context: {
    clientIP: string;
    headers: Headers;
  }) => string | Promise<string>;
  /**
   * Emit `RateLimit-*` headers (IETF draft-6) on every response.
   * @default true
   */
  standardHeaders?: boolean;
}

const draft6Headers = (
  limit: number,
  remaining: number,
  resetSeconds: number
): Record<string, string> => ({
  "RateLimit-Limit": String(limit),
  "RateLimit-Remaining": String(Math.max(remaining, 0)),
  "RateLimit-Reset": String(Math.max(resetSeconds, 0)),
});

/**
 * Fixed-window rate limiter backed by the shared Keyv store.
 *
 * Implemented directly instead of wrapping `hono-rate-limiter` so the same budget can
 * be enforced on an oRPC procedure — the previous setup could only rate limit whole
 * Hono route prefixes, which left every RPC procedure sharing one coarse counter.
 */
export const rateLimitPolicy = (options: RateLimitPolicyOptions): Policy => {
  const {
    windowMs,
    limit,
    prefix = "rate-limiter:root-request",
    keyGenerator,
    standardHeaders = true,
  } = options;

  return async (context) => {
    const kv: Keyv | undefined = context.kv;

    // No store — fail open rather than locking every caller out.
    if (!kv) {
      return allow();
    }

    const identifier = keyGenerator
      ? await keyGenerator({
          clientIP: context.clientIP,
          headers: context.headers,
        })
      : context.clientIP;

    const key = `${prefix}:ip-${identifier}`;
    const now = Date.now();

    let entry: RateLimitEntry;

    try {
      const stored = await kv.get<RateLimitEntry>(key);

      if (!stored || stored.resetTime <= now) {
        entry = { totalHits: 1, resetTime: now + windowMs };
        await kv.set(key, entry, windowMs);
      } else {
        entry = {
          totalHits: stored.totalHits + 1,
          resetTime: stored.resetTime,
        };
        await kv.set(key, entry, Math.max(entry.resetTime - now, 0));
      }
    } catch (error) {
      console.error("Rate limiter store error", error);
      return allow();
    }

    const resetSeconds = Math.ceil((entry.resetTime - now) / 1000);
    const headers = standardHeaders
      ? draft6Headers(limit, limit - entry.totalHits, resetSeconds)
      : undefined;

    if (entry.totalHits > limit) {
      return deny(
        new AppError("TOO_MANY_REQUESTS", {
          headers: {
            ...headers,
            "Retry-After": String(Math.max(resetSeconds, 1)),
          },
        })
      );
    }

    return allow(undefined, headers);
  };
};
