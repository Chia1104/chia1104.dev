import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createOpenAI } from "@chia/ai";
import { getFeedsWithMetaSchema } from "@chia/api/services/validators";
import { eq, schema } from "@chia/db";
import {
  getInfiniteFeedsByUserId,
  getInfiniteFeeds,
  searchFeeds,
} from "@chia/db/repos/feeds";

import { ai, AI_AUTH_TOKEN } from "@/middlewares/ai.middleware";
import { verifyAuth } from "@/middlewares/auth.middleware";
import { errorResponse } from "@/utils/error.util";
import { searchFeedsSchema } from "@/validators/feeds.validator";

const api = new Hono<HonoContext>();

api.use("/", verifyAuth()).get(
  "/",
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

api
  .use("/search", verifyAuth(true))
  .use("/search", ai())
  .get(
    "/search",
    zValidator("query", searchFeedsSchema, (result, c) => {
      if (!result.success) {
        return c.json(errorResponse(result.error), 400);
      }
    }),
    async (c) => {
      const client = createOpenAI({
        apiKey: c.get(AI_AUTH_TOKEN),
      });
      const { keyword, model } = c.req.valid("query");
      const feeds = await searchFeeds(c.var.db, {
        input: keyword ?? "",
        limit: 5,
        model,
        client,
      });
      return c.json(feeds);
    }
  );

export default api;
