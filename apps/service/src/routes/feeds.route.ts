import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { timeout } from "hono/timeout";
import * as z from "zod";

import { createOpenAI } from "@chia/ai";
import { isOllamaEmbeddingModel } from "@chia/ai/embeddings/utils";
import { isOpenAIEmbeddingModel } from "@chia/ai/embeddings/utils";
import { isOllamaEnabled } from "@chia/ai/ollama/utils";
import { getFeedsWithMetaSchema } from "@chia/api/services/validators";
import { locale } from "@chia/db";
import {
  getInfiniteFeedsByUserId,
  getInfiniteFeeds,
} from "@chia/db/repos/feeds";
import { Locale } from "@chia/db/types";

import { env } from "../env";
import { ai, AI_AUTH_TOKEN } from "../guards/ai.guard";
import { verifyAuth } from "../guards/auth.guard";
import { rateLimiterGuard } from "../guards/rate-limiter.guard";
import { searchFeedsService } from "../services/feeds.service";
import { errorResponse } from "../utils/error.util";
import { searchFeedsSchema } from "../validators/feeds.validator";

const api = new Hono<HonoContext>()
  .use(
    rateLimiterGuard({
      prefix: "rate-limiter:feeds",
    })
  )
  .use(timeout(env.TIMEOUT_MS))
  .use("/", verifyAuth())
  .get(
    "/",
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
        locale,
      } = c.req.valid("query");
      const feeds = await getInfiniteFeedsByUserId(c.var.db, {
        type,
        limit,
        orderBy,
        sortOrder,
        cursor: nextCursor,
        withContent: withContent === "true",
        locale,
        userId: c.get("user")?.id ?? "",
      });
      return c.json(feeds);
    }
  )
  .get(
    "/public",
    zValidator(
      "query",
      getFeedsWithMetaSchema.extend({
        locale: z.enum(locale.enumValues).optional(),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json(errorResponse(result.error), 400);
        }
      }
    ),
    async (c) => {
      const {
        type,
        limit,
        orderBy,
        sortOrder,
        nextCursor,
        withContent,
        locale,
      } = c.req.valid("query");
      const feeds = await getInfiniteFeeds(c.var.db, {
        type,
        limit,
        orderBy,
        sortOrder,
        cursor: nextCursor,
        withContent: withContent === "true",
        locale,
        whereAnd: { published: true },
      });
      return c.json(feeds);
    }
  )
  .use(
    "/search",
    verifyAuth((c) => isOpenAIEmbeddingModel(c.req.query("model")))
  )
  .use(
    "/search",
    ai("openai", (c) => isOpenAIEmbeddingModel(c.req.query("model")))
  )
  .get(
    "/search",
    zValidator(
      "query",
      searchFeedsSchema.extend({
        locale: z.enum(Locale).optional(),
      }),
      (result, c) => {
        if (!result.success) {
          return c.json(errorResponse(result.error), 400);
        }
      }
    ),
    async (c) => {
      const { keyword, model, locale } = c.req.valid("query");
      const isOllama =
        isOllamaEmbeddingModel(model) && (await isOllamaEnabled(model));

      const client = isOllama
        ? undefined
        : createOpenAI({
            apiKey: c.get(AI_AUTH_TOKEN),
          });

      const items = await searchFeedsService({
        db: c.var.db,
        kv: c.var.kv,
        keyword,
        model,
        locale,
        client,
      });
      return c.json(items);
    }
  );

export default api;
