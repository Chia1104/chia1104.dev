import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { getRuntimeKey } from "hono/adapter";
import { z } from "zod";

import { numericStringSchema } from "@chia/utils";
import { delay } from "@chia/utils/delay";

import { verifyAuth } from "@/guards/auth.guard";
import { IS_MAINTENANCE_MODE } from "@/middlewares/maintenance.middleware";
import { errorResponse } from "@/utils/error.util";

const api = new Hono<HonoContext>();

api.get("/", (c) =>
  c.json({
    status: !IS_MAINTENANCE_MODE ? "ok" : "maintenance",
  })
);

api.get("/runtime", (c) => c.text(getRuntimeKey()));

api.get("/delayed", verifyAuth(true)).get(
  "/delayed",
  zValidator("query", z.object({ ms: numericStringSchema }), (result, c) => {
    if (!result.success) {
      return c.json(errorResponse(result.error), 400);
    }
  }),
  async (c) => {
    const ms = c.req.valid("query").ms;
    await delay(ms);
    return c.json({
      delay: ms,
    });
  }
);

export default api;
