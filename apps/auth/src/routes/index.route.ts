import { Hono } from "hono";
import { timeout } from "hono/timeout";

import { env } from "../env";

const api = new Hono<HonoContext>()
  .use(timeout(env.TIMEOUT_MS))
  .on(["GET", "POST"], ["*"], async (c) => {
    return await c.var.auth.handler(c.req.raw);
  });

export default api;
