import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { getInfiniteFeeds } from "@chia/db";
import { errorGenerator } from "@chia/utils";

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
        ),
        400
      );
    }
  }),
  async (c) => {
    const { type, limit, orderBy, sortOrder, cursor } = c.req.query();
    const feeds = await getInfiniteFeeds(c.var.db, {
      type: type as GetFeedsWithMetaDTO["type"],
      limit: Number(limit),
      orderBy: orderBy as GetFeedsWithMetaDTO["orderBy"],
      sortOrder: sortOrder as GetFeedsWithMetaDTO["sortOrder"],
      cursor: cursorTransform(cursor),
    });
    return c.json(feeds);
  }
);

export default api;
