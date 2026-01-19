import { Hono } from "hono";
import { timeout } from "hono/timeout";

import { env } from "@/env";
import { IS_MAINTENANCE_MODE } from "@/middlewares/maintenance.middleware";

const api = new Hono<HonoContext>().use(timeout(env.TIMEOUT_MS)).get("/", (c) =>
  c.json({
    status: !IS_MAINTENANCE_MODE ? "ok" : "maintenance",
  })
);

export default api;
