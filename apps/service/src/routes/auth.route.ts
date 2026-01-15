import { Hono } from "hono";
import { timeout } from "hono/timeout";

import { auth } from "@chia/auth";

import { env } from "@/env";

const api = new Hono<HonoContext>();

api.use(timeout(env.TIMEOUT_MS));

api.on(["GET", "POST"], "*", (c) => {
  return auth.handler(c.req.raw);
});

export default api;
