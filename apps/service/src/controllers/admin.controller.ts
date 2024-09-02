import { Hono } from "hono";

import { getPublicFeedsTotal } from "@chia/db/utils/public/feeds";
import { errorGenerator, getAdminId } from "@chia/utils";

const api = new Hono<HonoContext>();

api.get("/public/feeds:meta", async (c) => {
  let total = 0;
  try {
    total = await getPublicFeedsTotal(c.var.db, getAdminId());
  } catch (err) {
    c.var.sentry.captureException(err);
    return c.json(errorGenerator(500), 500);
  }
  return c.json({
    total,
  });
});

export default api;
