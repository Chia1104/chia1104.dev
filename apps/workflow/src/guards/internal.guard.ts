import { createMiddleware } from "hono/factory";

import { isValidInternalToken, X_CH_INTERNAL_TOKEN } from "@chia/utils/gateway";
import { errorGenerator } from "@chia/utils/server";

import { env } from "../env";

/**
 * Guards the server-to-server workflow trigger routes with the shared
 * internal token. The workflow service has no public ingress (the gateway
 * answers 404 for /workflow*), so these routes are only reachable over the
 * private network — the token is defense in depth.
 */
export const internalGuard = () =>
  createMiddleware<HonoContext>(async (c, next) => {
    if (!env.INTERNAL_WORKFLOW_SERVICE_TOKEN) {
      return c.json(errorGenerator(503), 503);
    }

    const token = c.req.raw.headers.get(X_CH_INTERNAL_TOKEN);

    if (
      !token ||
      !isValidInternalToken(token, env.INTERNAL_WORKFLOW_SERVICE_TOKEN)
    ) {
      return c.json(errorGenerator(401), 401);
    }

    await next();
  });
