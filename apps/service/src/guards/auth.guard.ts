import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

import { applyPolicy } from "@chia/service-kit/adapters/hono";
import { sessionPolicy } from "@chia/service-kit/policies";

type AuthContext = HonoContext;

/**
 * Requires an authenticated session, optionally `Role.Root`.
 *
 * The check itself is the shared `sessionPolicy` — the oRPC side binds the exact same
 * policy in `packages/api/orpc/guards/auth.guard.ts`. Only the "is root required for
 * *this* request" decision stays here, because it reads the raw request (see
 * `feeds.route.ts`, where it depends on the `model` query param) and a policy never
 * sees a `Request`.
 *
 * The resolved session lands on `c.var.session`.
 */
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
