import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { getInfiniteFeedsByUserId, getFeedBySlug } from "@chia/db/repos/feeds";
import { getPublicFeedsTotal } from "@chia/db/repos/public/feeds";
import { errorGenerator, getAdminId } from "@chia/utils";

import { errorResponse } from "@/utils/error.util";
import { getFeedsWithMetaSchema } from "@/validators/feeds.validator";

const api = new Hono<HonoContext>();
const adminId = getAdminId();

api.get("/public/feeds:meta", async (c) => {
  let total = 0;
  try {
    total = await getPublicFeedsTotal(c.var.db, adminId);
  } catch (err) {
    c.var.sentry.captureException(err);
    return c.json(errorGenerator(500), 500);
  }
  return c.json({
    total,
  });
});

api.get(
  "/public/feeds",
  zValidator("query", getFeedsWithMetaSchema, (result, c) => {
    if (!result.success) {
      return c.json(errorResponse(result.error), 400);
    }
  }),
  async (c) => {
    const { type, limit, orderBy, sortOrder, nextCursor, withContent } =
      c.req.valid("query");
    const feeds = await getInfiniteFeedsByUserId(c.var.db, {
      type,
      limit,
      orderBy,
      sortOrder,
      cursor: nextCursor,
      withContent: withContent === "true",
      userId: adminId,
    });
    return c.json(feeds);
  }
);

api.get("/public/feeds/:slug", async (c) => {
  if (!c.req.param("slug")) {
    return c.json(errorGenerator(400), 400);
  }
  const feed = await getFeedBySlug(c.var.db, c.req.param("slug"));
  if (!feed) {
    return c.json(errorGenerator(404), 404);
  }
  return c.json(feed);
});

export default api;
