import { verifyAuth } from "@hono/auth-js";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import {
  getInfiniteFeedsByUserId,
  getInfiniteFeeds,
  eq,
  schema,
} from "@chia/db";

import { errorResponse } from "@/utils/error.util";
import { getFeedsWithMetaSchema } from "@/validators/feeds.validator";

const api = new Hono<HonoContext>();

api.use("/", verifyAuth()).get(
  "/",
  zValidator("query", getFeedsWithMetaSchema, (result, c) => {
    if (!result.success) {
      return c.json(errorResponse(result.error));
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
      userId: c.get("authUser").user?.id ?? "",
    });
    return c.json(feeds);
  }
);

api.get(
  "/public",
  zValidator("query", getFeedsWithMetaSchema, (result, c) => {
    if (!result.success) {
      return c.json(errorResponse(result.error), 400);
    }
  }),
  async (c) => {
    const { type, limit, orderBy, sortOrder, nextCursor, withContent } =
      c.req.valid("query");
    const feeds = await getInfiniteFeeds(c.var.db, {
      type,
      limit,
      orderBy,
      sortOrder,
      cursor: nextCursor,
      withContent: withContent === "true",
      whereAnd: [eq(schema.feeds.published, true)],
    });
    return c.json(feeds);
  }
);

export default api;
