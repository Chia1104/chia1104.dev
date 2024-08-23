import { Hono } from "hono";

import { eq, schema, count } from "@chia/db";
import { getAdminId } from "@chia/utils";

const api = new Hono<HonoContext>();

/**
 * TODO: handle caching
 */
api.get("/public/feeds:meta", async (c) => {
  return c.json({
    total: (
      await c.var.db
        .select({ count: count(schema.feeds.published) })
        .from(schema.feeds)
        .where(eq(schema.feeds.userId, getAdminId()))
    )[0].count,
  });
});

export default api;
