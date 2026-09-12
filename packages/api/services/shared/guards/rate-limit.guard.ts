import { runPolicy } from "@chia/service-kit/adapters/orpc";
import { rateLimitPolicy } from "@chia/service-kit/policies/rate-limit.policy";

import type { RateLimitName } from "../rate-limits";
import { RATE_LIMITS } from "../rate-limits";

import { callerOS } from "./caller.guard";

/**
 * Per-procedure budget from {@link RATE_LIMITS}, counted against the caller's tier. Chain
 * after `callerGuard`. The transport-level `rpc` budget still runs first.
 */
export const rateLimitGuard = (name: RateLimitName) =>
  callerOS
    .errors({
      TOO_MANY_REQUESTS: {},
    })
    .middleware(async ({ next, context }) => {
      await runPolicy(
        rateLimitPolicy({
          prefix: `rate-limiter:${name}`,
          ...RATE_LIMITS[name],
        }),
        context
      );

      return next();
    });
