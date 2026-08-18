import { toHonoMiddleware } from "@chia/service-kit/adapters/hono";
import { rateLimitPolicy } from "@chia/service-kit/policies/rate-limit.policy";

import { env } from "../env";

/**
 * Fixed-window rate limiting over the shared Keyv store.
 *
 * The counting now lives in `rateLimitPolicy`, so the same budget can be applied to a
 * single oRPC procedure — previously only whole Hono route prefixes could be limited,
 * which left every RPC procedure sharing one coarse counter.
 */
export const rateLimiterGuard = (options?: {
  windowMs?: number;
  limit?: number;
  prefix?: string;
}) =>
  toHonoMiddleware(
    rateLimitPolicy({
      windowMs: options?.windowMs ?? env.RATELIMIT_WINDOW_MS,
      limit: options?.limit ?? env.RATELIMIT_MAX,
      prefix: options?.prefix ?? "rate-limiter:root-request",
    })
  );
