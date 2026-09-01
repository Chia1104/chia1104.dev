import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

import { applyPolicy } from "@chia/service-kit/adapters/hono";
import { sessionPolicy } from "@chia/service-kit/policies/session.policy";

type AuthContext = HonoContext;

/** `rootOnly` can read the raw request; `sessionPolicy` never sees a `Request`. */
export const verifyAuth = (
  rootOnly?: boolean | ((c: Context<AuthContext>) => boolean | Promise<boolean>)
) =>
  createMiddleware<AuthContext>(async (c, next) => {
    const requireRoot =
      rootOnly instanceof Function ? await rootOnly(c) : Boolean(rootOnly);

    const denied = await applyPolicy(
      c,
      sessionPolicy({ rootOnly: requireRoot })
    );

    if (denied) {
      return denied;
    }

    await next();
  });
