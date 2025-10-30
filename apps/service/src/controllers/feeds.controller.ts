import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import _ from "lodash";

import { createOpenAI } from "@chia/ai";
import { isOllamaEmbeddingModel } from "@chia/ai/embeddings/ollama";
import { getFeedsWithMetaSchema } from "@chia/api/services/validators";
import { eq, schema } from "@chia/db";
import {
  getInfiniteFeedsByUserId,
  getInfiniteFeeds,
} from "@chia/db/repos/feeds";
import { searchFeeds } from "@chia/db/repos/feeds/embedding";

import { ai, AI_AUTH_TOKEN } from "@/guards/ai.guard";
import { verifyAuth } from "@/guards/auth.guard";
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
      userId: c.get("user")?.id ?? "",
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
  .use(
    "/search",
    verifyAuth((c) => {
      const model = c.req.query("model");
      return !isOllamaEmbeddingModel(model);
    })
  )
  .use(
    "/search",
    ai("openai", (c) => {
      const model = c.req.query("model");
      return !isOllamaEmbeddingModel(model);
    })
  )
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
      const cache = c.var.redis;
      const cacheKey = `feeds:search:m:${model ?? "default"}:k:${_.snakeCase(keyword)}`;
      const cached = await cache.get<string>(cacheKey);
      if (cached) {
        const { items } = await searchFeeds(c.var.db, {
          input: keyword ?? "",
          limit: 5,
          model: isOllamaEmbeddingModel(model) ? undefined : model,
          useOllama: isOllamaEmbeddingModel(model) ? { model } : undefined,
          client,
          embedding: JSON.parse(cached) as number[],
        });
        return c.json(items);
      }
      const { items, embedding } = await searchFeeds(c.var.db, {
        input: keyword ?? "",
        limit: 5,
        model: isOllamaEmbeddingModel(model) ? undefined : model,
        useOllama: isOllamaEmbeddingModel(model) ? { model } : undefined,
        client,
      });
      await cache.set(cacheKey, JSON.stringify(embedding));
      return c.json(items);
    }
  );

export default api;
