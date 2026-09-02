import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

import { applyPolicy } from "@chia/service-kit/adapters/hono";
import { sessionPolicy } from "@chia/service-kit/policies/session.policy";

type AuthContext = HonoContext;

export interface VerifyAuthOptions {
  /** `rootOnly` can read the raw request; `sessionPolicy` never sees a `Request`. */
  rootOnly?:
    | boolean
    | ((c: Context<AuthContext>) => boolean | Promise<boolean>);
  /** Admit a guest minted by better-auth's `anonymous()`. Off by default. */
  allowAnonymous?: boolean;
}

export const verifyAuth = (options: VerifyAuthOptions = {}) =>
  createMiddleware<AuthContext>(async (c, next) => {
    const requireRoot =
      options.rootOnly instanceof Function
        ? await options.rootOnly(c)
        : Boolean(options.rootOnly);

    const denied = await applyPolicy(
      c,
      sessionPolicy({
        rootOnly: requireRoot,
        allowAnonymous: options.allowAnonymous,
      })
    );

    if (denied) {
      return denied;
    }

    await next();
  });
