import { toHonoMiddleware } from "@chia/service-kit/adapters/hono";
import { rateLimitPolicy } from "@chia/service-kit/policies/rate-limit.policy";

import { env } from "../env";

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
