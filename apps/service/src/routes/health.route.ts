import { Hono } from "hono";
import { timeout } from "hono/timeout";

import { isMaintenanceEnabled } from "@chia/service-kit/middlewares/maintenance";

import { env } from "../env";

const api = new Hono<HonoContext>().use(timeout(env.TIMEOUT_MS)).get("/", (c) =>
  c.json({
    status: !isMaintenanceEnabled(env.MAINTENANCE_MODE) ? "ok" : "maintenance",
  })
);

export default api;
