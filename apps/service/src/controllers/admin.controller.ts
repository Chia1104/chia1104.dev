import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod/v4";

import {
  getFeedsWithMetaSchema,
  insertFeedMetaRequestSchema,
  updateFeedRequestSchema,
} from "@chia/api/services/validators";
import { eq } from "@chia/db";
import { schema } from "@chia/db";
import {
  getInfiniteFeedsByUserId,
  getFeedBySlug,
  getFeedMetaById,
  createFeedMeta,
  getFeedById,
  updateFeed,
} from "@chia/db/repos/feeds";
import { getPublicFeedsTotal } from "@chia/db/repos/public/feeds";
import { errorGenerator, getAdminId, numericStringSchema } from "@chia/utils";

import { env } from "@/env";
import { apikeyVerify } from "@/guards/apikey-verify.guard";
import { errorResponse } from "@/utils/error.util";

const api = new Hono<HonoContext>();
const adminId = getAdminId();

api.use(
  "*",
  apikeyVerify({
    projectId: env.PROJECT_ID,
  })
);

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
    const {
      type,
      limit,
      orderBy,
      sortOrder,
      nextCursor,
      withContent,
      published,
    } = c.req.valid("query");
    const feeds = await getInfiniteFeedsByUserId(c.var.db, {
      type,
      limit,
      orderBy,
      sortOrder,
      cursor: nextCursor,
      withContent: withContent === "true",
      userId: adminId,
      whereAnd: [eq(schema.feeds.published, published === "true")],
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

api.get(
  "/public/feeds:id/:id",
  zValidator(
    "param",
    z.object({
      id: numericStringSchema,
    }),
    (result, c) => {
      if (!result.success) {
        return c.json(errorResponse(result.error), 400);
      }
    }
  ),
  async (c) => {
    const id = c.req.valid("param").id;
    const feed = await getFeedById(c.var.db, id);
    if (!feed) {
      return c.json(errorGenerator(404), 404);
    }
    return c.json(feed);
  }
);

api.get(
  "/public/feeds:meta/:id",
  zValidator(
    "param",
    z.object({
      id: numericStringSchema,
    }),
    (result, c) => {
      if (!result.success) {
        return c.json(errorResponse(result.error), 400);
      }
    }
  ),
  async (c) => {
    const id = c.req.valid("param").id;
    const feed = await getFeedMetaById(c.var.db, {
      feedId: id,
      withContent: true,
    });
    if (!feed) {
      return c.json(null);
    }
    return c.json(feed);
  }
);

api.post(
  "/public/feeds:meta",
  zValidator("json", insertFeedMetaRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json(errorResponse(result.error), 400);
    }
  }),
  async (c) => {
    const { feedId, summary } = c.req.valid("json");
    await createFeedMeta(c.var.db, {
      feedId,
      summary,
    });
    return c.body(null, 204);
  }
);

api.post(
  "/public/feeds/:id",
  zValidator("json", updateFeedRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json(errorResponse(result.error), 400);
    }
  }),
  async (c) => {
    const dto = c.req.valid("json");
    const feed = await updateFeed(c.var.db, {
      ...dto,
      feedId: Number(c.req.param("id")),
    });
    return c.json(feed);
  }
);

export default api;
