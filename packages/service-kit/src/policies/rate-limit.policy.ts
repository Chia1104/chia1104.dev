import type { CallerTier } from "@chia/auth/tier";
import type { Keyv } from "@chia/kv/types";

import type { ServiceContext } from "../context";
import { AppError } from "../errors";

import type { Caller } from "./caller.policy";
import type { Policy } from "./types";
import { allow, deny } from "./types";

interface RateLimitEntry {
  totalHits: number;
  resetTime: number;
}

export interface RateLimitBudget {
  windowMs: number;
  /** Requests per window for each tier. A tier without an entry is never counted. */
  limit: Partial<Record<CallerTier, number>>;
}

export interface RateLimitPolicyOptions extends RateLimitBudget {
  /** Namespaces the counter, so each route family gets its own budget. */
  prefix: string;
  /**
   * Emit `RateLimit-*` headers (IETF draft-6) on every response.
   * @default true
   */
  standardHeaders?: boolean;
}

/** The caller must already be resolved; chain after `callerPolicy`. */
export type RateLimitContext = ServiceContext & { caller: Caller };

/** Authenticated callers are counted per principal, not per address. */
const callerKey = (caller: Caller, clientIP: string): string => {
  if (caller.session) return `user-${caller.session.user.id}`;
  if (caller.apiKey) return `key-${caller.apiKey.id}`;
  return `ip-${clientIP}`;
};

const draft6Headers = (
  limit: number,
  remaining: number,
  resetSeconds: number
) => ({
  "RateLimit-Limit": String(limit),
  "RateLimit-Remaining": String(Math.max(remaining, 0)),
  "RateLimit-Reset": String(Math.max(resetSeconds, 0)),
});

/** Fixed-window rate limiter on the shared Keyv store, budgeted by caller tier. */
export const rateLimitPolicy = (
  options: RateLimitPolicyOptions
): Policy<Record<never, never>, RateLimitContext> => {
  const { windowMs, limit: budget, prefix, standardHeaders = true } = options;

  return async (context) => {
    const limit = budget[context.caller.tier];

    if (limit === undefined) {
      return allow();
    }

    const kv: Keyv | undefined = context.kv;

    // No store — fail open rather than locking every caller out.
    if (!kv) {
      return allow();
    }

    const key = `${prefix}:${callerKey(context.caller, context.clientIP)}`;
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
