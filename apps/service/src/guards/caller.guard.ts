import { createMiddleware } from "hono/factory";

import { applyPolicy } from "@chia/service-kit/adapters/hono";
import { callerPolicy } from "@chia/service-kit/policies/caller.policy";

/**
 * Grades the caller once per request onto `c.var.caller` (and its session). Every guard
 * behind it, Hono or oRPC, reuses that instead of verifying credentials again.
 */
export const resolveCaller = () =>
  createMiddleware<HonoContext>(async (c, next) => {
    const denied = await applyPolicy(c, callerPolicy());

    if (denied) {
      return denied;
    }

    await next();
  });
