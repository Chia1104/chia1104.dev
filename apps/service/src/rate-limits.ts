import { CallerTier } from "@chia/auth/tier";
import type { RateLimitBudget } from "@chia/service-kit/policies/rate-limit.policy";

const MINUTE = 60_000;

/**
 * Abuse ceiling per HTTP mount, applied before any procedure budget. A tier absent from
 * `limit` is never counted, so `Root` is unlimited.
 */
export const MOUNT_RATE_LIMITS = {
  rpc: {
    windowMs: MINUTE,
    limit: {
      [CallerTier.Anonymous]: 300,
      [CallerTier.Guest]: 300,
      [CallerTier.ApiKey]: 3000,
      [CallerTier.Session]: 1200,
    },
  },
  ai: {
    windowMs: MINUTE,
    limit: {
      [CallerTier.Anonymous]: 20,
      [CallerTier.Guest]: 30,
      [CallerTier.ApiKey]: 60,
      [CallerTier.Session]: 60,
    },
  },
  /** Only the operator passes `verifyOperator`; this bounds probing before that check. */
  mcp: {
    windowMs: MINUTE,
    limit: {
      [CallerTier.Anonymous]: 30,
      [CallerTier.Guest]: 30,
      [CallerTier.ApiKey]: 60,
      [CallerTier.Session]: 60,
    },
  },
} satisfies Record<string, RateLimitBudget>;

export type MountRateLimitName = keyof typeof MOUNT_RATE_LIMITS;
