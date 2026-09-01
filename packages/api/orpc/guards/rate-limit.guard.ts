import { runPolicy } from "@chia/service-kit/adapters/orpc";
import { rateLimitPolicy } from "@chia/service-kit/policies/rate-limit.policy";

import { baseOS } from "../utils";

/**
 * Per-procedure rate limiting. The `/rpc` and REST mounts already apply a coarse
 * transport-level budget; this narrows it for a single procedure.
 */
export const rateLimitGuard = (options: {
  prefix: string;
  windowMs?: number;
  limit?: number;
}) =>
  baseOS
    .errors({
      TOO_MANY_REQUESTS: {},
    })
    .middleware(async ({ next, context }) => {
      const defaults = context.config.rateLimit;

      await runPolicy(
        rateLimitPolicy({
          prefix: options.prefix,
          windowMs: options.windowMs ?? defaults.windowMs,
          limit: options.limit ?? defaults.limit,
        }),
        context
      );

      return next();
    });
