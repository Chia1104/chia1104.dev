import { Hono } from "hono";
import { timeout } from "hono/timeout";

import { auth } from "@chia/auth";

import { env } from "@/env";

/**
 * @TODO: Remove this route when the auth service is migrated to separate service
 */
const api = new Hono<HonoContext>()
  .use(timeout(env.TIMEOUT_MS))
  .on(["GET", "POST"], "*", (c) => {
    return auth.handler(c.req.raw);
  });

export default api;
