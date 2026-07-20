import { Hono } from "hono";
import { timeout } from "hono/timeout";

import { env } from "../env";

const api = new Hono<HonoContext>().use(timeout(env.TIMEOUT_MS)).get("/", (c) =>
  c.json({
    status: "ok",
  })
);

export default api;
