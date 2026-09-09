import { createMiddleware } from "hono/factory";

import { ApiKeyScope } from "@chia/auth/apikey";
import { CallerTier } from "@chia/auth/tier";
import { applyPolicy } from "@chia/service-kit/adapters/hono";
import { callerPolicy } from "@chia/service-kit/policies/caller.policy";

/** Admits the operator only: a Root session, or an admin-owned key carrying `operator:root`. */
export const verifyOperator = () =>
  createMiddleware<HonoContext>(async (c, next) => {
    const denied = await applyPolicy(
      c,
      callerPolicy({
        minTier: CallerTier.Root,
        scopes: [ApiKeyScope.OperatorRoot],
      })
    );

    if (denied) {
      return denied;
    }

    await next();
  });
