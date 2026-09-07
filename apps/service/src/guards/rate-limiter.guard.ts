import { createMiddleware } from "hono/factory";

import { applyPolicy } from "@chia/service-kit/adapters/hono";
import { rateLimitPolicy } from "@chia/service-kit/policies/rate-limit.policy";

import type { MountRateLimitName } from "../rate-limits";
import { MOUNT_RATE_LIMITS } from "../rate-limits";

/** The mount's budget from {@link MOUNT_RATE_LIMITS}. Chain after `resolveCaller()`. */
export const rateLimiterGuard = (name: MountRateLimitName) =>
  createMiddleware<HonoContext>(async (c, next) => {
    const denied = await applyPolicy(
      c,
      rateLimitPolicy({
        prefix: `rate-limiter:${name}`,
        ...MOUNT_RATE_LIMITS[name],
      })
    );

    if (denied) {
      return denied;
    }

    await next();
  });
