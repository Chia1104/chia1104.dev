import { Hono } from "hono";

import { IS_MAINTENANCE_MODE } from "@/middlewares/maintenance.middleware";

const api = new Hono<HonoContext>();

api.get("/", (c) =>
  c.json({
    status: !IS_MAINTENANCE_MODE ? "ok" : "maintenance",
  })
);

export default api;
