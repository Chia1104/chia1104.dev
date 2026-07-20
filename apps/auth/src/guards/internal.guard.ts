import { createMiddleware } from "hono/factory";

import { isValidInternalToken, X_CH_INTERNAL_TOKEN } from "@chia/utils/gateway";
import { errorGenerator } from "@chia/utils/server";

import { env } from "../env";

/**
 * Guards server-to-server routes with the shared internal token. These routes
 * expose better-auth SERVER_ONLY methods, so they must never be reachable
 * without the token (nor exposed through a public ingress).
 */
export const internalGuard = () =>
  createMiddleware<HonoContext>(async (c, next) => {
    if (!env.INTERNAL_AUTH_SERVICE_TOKEN) {
      return c.json(errorGenerator(503), 503);
    }

    const token = c.req.raw.headers.get(X_CH_INTERNAL_TOKEN);

    if (
      !token ||
      !isValidInternalToken(token, env.INTERNAL_AUTH_SERVICE_TOKEN)
    ) {
      return c.json(errorGenerator(401), 401);
    }

    await next();
  });
