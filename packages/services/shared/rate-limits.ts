import { CallerTier } from "@chia/auth/tier";
import type { RateLimitBudget } from "@chia/service-kit/policies/rate-limit.policy";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Every procedure rate-limit budget, keyed by route family. Counters are per principal for
 * signed-in and keyed callers and per address otherwise. A tier absent from `limit` is never
 * counted, so `Root` is unlimited unless a family names it. The mounts that carry these
 * procedures budget themselves in the hosting app.
 */
export const RATE_LIMITS = {
  feeds: {
    windowMs: MINUTE,
    limit: {
      [CallerTier.Anonymous]: 60,
      [CallerTier.Guest]: 120,
      [CallerTier.ApiKey]: 3000,
      [CallerTier.Session]: 600,
    },
  },
  spotify: {
    windowMs: MINUTE,
    limit: {
      [CallerTier.Anonymous]: 30,
      [CallerTier.Guest]: 60,
      [CallerTier.ApiKey]: 300,
      [CallerTier.Session]: 300,
    },
  },
  toolings: {
    windowMs: MINUTE,
    limit: {
      [CallerTier.Anonymous]: 30,
      [CallerTier.Guest]: 60,
      [CallerTier.ApiKey]: 300,
      [CallerTier.Session]: 300,
    },
  },
  email: {
    windowMs: HOUR,
    limit: {
      [CallerTier.Anonymous]: 5,
      [CallerTier.Guest]: 5,
      [CallerTier.ApiKey]: 20,
      [CallerTier.Session]: 20,
    },
  },
  /** The operator too: a full reindex is the one action with an unbounded bill. */
  "rag-bulk": {
    windowMs: HOUR,
    limit: { [CallerTier.Root]: 2 },
  },
} satisfies Record<string, RateLimitBudget>;

export type RateLimitName = keyof typeof RATE_LIMITS;
