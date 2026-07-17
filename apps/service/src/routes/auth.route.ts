import { Hono } from "hono";
import { timeout } from "hono/timeout";

import { env } from "../env";

/**
 * When INTERNAL_AUTH_SERVICE_ENDPOINT is set this proxies to the standalone
 * auth service (`apps/auth`); otherwise it is served by the in-process
 * better-auth instance. Remove once clients point at the auth service directly.
 */
const api = new Hono<HonoContext>()
  .use(timeout(env.TIMEOUT_MS))
  .on(["GET", "POST"], ["*"], async (c) => {
    if (!c.var.auth) {
      return c.json({ message: "Unauthorized" }, 401);
    }
    return await c.var.auth.handler(c.req.raw);
  });

export default api;
