import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { timeout } from "hono/timeout";
import * as z from "zod";

import {
  getFeedsWithMetaSchema,
  upsertFeedTranslationRequestSchema,
  upsertContentRequestSchema,
  updateFeedRequestSchema,
} from "@chia/api/services/validators";
import { locale } from "@chia/db";
import {
  getInfiniteFeedsByUserId,
  getFeedBySlug,
  getFeedById,
  upsertFeedTranslation,
  upsertContent,
  updateFeed,
} from "@chia/db/repos/feeds";
import { getPublicFeedsTotal } from "@chia/db/repos/public/feeds";
import { getAdminId } from "@chia/utils/config";
import { NumericStringSchema } from "@chia/utils/schema";
import { errorGenerator } from "@chia/utils/server";

import { env } from "../env";
import { apikeyVerify } from "../guards/apikey-verify.guard";
import { errorResponse } from "../utils/error.util";

const adminId = getAdminId();

const api = new Hono<HonoContext>()
  .use(
    apikeyVerify({
      projectId: env.PROJECT_ID,
    })
  )
  .use(timeout(env.TIMEOUT_MS))
  .get("/public/feeds:meta", async (c) => {
    let total = 0;
    try {
      total = (await getPublicFeedsTotal(c.var.db, adminId)) ?? 0;
    } catch (err) {
      c.var.sentry.captureException(err);
      return c.json(errorGenerator(500), 500);
    }
    return c.json({
      total,
    });
  })
  .get(
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
        locale,
      } = c.req.valid("query");
      const feeds = await getInfiniteFeedsByUserId(c.var.db, {
        type,
        limit,
        orderBy,
        sortOrder,
        cursor: nextCursor,
        withContent: withContent === "true",
        userId: adminId,
        locale,
        whereAnd: { published: published === "true" },
      });
      return c.json(feeds);
    }
  )
  .get(
    "/public/feeds/:slug",
    zValidator(
      "query",
      z
        .object({
          locale: z.enum(locale.enumValues).optional(),
        })
        .optional(),
      (result, c) => {
        if (!result.success) {
          return c.json(errorResponse(result.error), 400);
        }
      }
    ),
    async (c) => {
      if (!c.req.param("slug")) {
        return c.json(errorGenerator(400), 400);
      }
      const { locale } = c.req.valid("query") ?? {};
      const feed = await getFeedBySlug(c.var.db, {
        slug: c.req.param("slug"),
        locale,
      });
      if (!feed) {
        return c.json(errorGenerator(404), 404);
      }
      return c.json(feed);
    }
  )
  .get(
    "/public/feeds:id/:id",
    zValidator(
      "param",
      z.object({
        id: NumericStringSchema,
      }),
      (result, c) => {
        if (!result.success) {
          return c.json(errorResponse(result.error), 400);
        }
      }
    ),
    zValidator(
      "query",
      z
        .object({
          locale: z.enum(locale.enumValues).optional(),
        })
        .optional(),
      (result, c) => {
        if (!result.success) {
          return c.json(errorResponse(result.error), 400);
        }
      }
    ),
    async (c) => {
      const id = c.req.valid("param").id;
      const { locale } = c.req.valid("query") ?? {};
      const feed = await getFeedById(c.var.db, {
        feedId: id,
        locale,
      });
      if (!feed) {
        return c.json(errorGenerator(404), 404);
      }
      return c.json(feed);
    }
  )
  .post(
    "/public/feeds:translation",
    zValidator("json", upsertFeedTranslationRequestSchema, (result, c) => {
      if (!result.success) {
        return c.json(errorResponse(result.error), 400);
      }
    }),
    async (c) => {
      const dto = c.req.valid("json");
      await upsertFeedTranslation(c.var.db, dto);
      return c.body(null, 204);
    }
  )
  .post(
    "/public/feeds:content",
    zValidator("json", upsertContentRequestSchema, (result, c) => {
      if (!result.success) {
        return c.json(errorResponse(result.error), 400);
      }
    }),
    async (c) => {
      const dto = c.req.valid("json");
      await upsertContent(c.var.db, dto);
      return c.body(null, 204);
    }
  )
  .post(
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
