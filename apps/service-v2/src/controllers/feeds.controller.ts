import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { getRuntimeKey } from "hono/adapter";

import { getInfiniteFeeds } from "@chia/db";
import { errorGenerator } from "@chia/utils";

import { DRIZZLE_ORM } from "@/middlewares/drizzle.middleware";
import { cursorTransform } from "@/services/feeds.service";
import { getFeedsWithMetaSchema } from "@/validators/feeds.validator";
import type { GetFeedsWithMetaDTO } from "@/validators/feeds.validator";

const api = new Hono<HonoContext>();

api.get(
  "/",
  zValidator("query", getFeedsWithMetaSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        errorGenerator(
          400,
          result.error.issues?.map((issue) => {
            return {
              field: issue.path.join("."),
              message: issue.message,
            };
          })
        )
      );
    }
  }),
  async (c) => {
    const { type, limit, orderBy, sortOrder, cursor } = c.req.query();
    const db = c.get(DRIZZLE_ORM);
    const feeds = await getInfiniteFeeds(db, {
      type: type as GetFeedsWithMetaDTO["type"],
      limit: Number(limit),
      orderBy: orderBy as GetFeedsWithMetaDTO["orderBy"],
      sortOrder: sortOrder as GetFeedsWithMetaDTO["sortOrder"],
      cursor: cursorTransform(cursor),
    });
    return c.json(feeds);
  }
);

api.get("/test", (c) => {
  return c.text(getRuntimeKey());
});

export default api;
