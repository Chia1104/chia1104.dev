import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { timeout } from "hono/timeout";
import * as z from "zod";

import { createOpenAI } from "@chia/ai";
import { isOllamaEmbeddingModel } from "@chia/ai/embeddings/utils";
import { isOpenAIEmbeddingModel } from "@chia/ai/embeddings/utils";
import { isOllamaEnabled } from "@chia/ai/ollama/utils";
import { publicFeedSearchQuerySchema } from "@chia/api/services/validators";
import { OllamaUnavailableError } from "@chia/db/repos/feeds/embedding";
import { Locale } from "@chia/db/types";

import { env } from "../env";
import { ai, AI_AUTH_TOKEN } from "../guards/ai.guard";
import { verifyAuth } from "../guards/auth.guard";
import { rateLimiterGuard } from "../guards/rate-limiter.guard";
import {
  searchFeedsService,
  searchPublicFeedsService,
  UnindexedEmbeddingModelError,
} from "../services/feeds.service";
import { errorResponse } from "../utils/error.util";
import { searchFeedsSchema } from "../validators/feeds.validator";

const api = new Hono<HonoContext>()
  .use(
    rateLimiterGuard({
      prefix: "rate-limiter:feeds",
    })
  )
  .use(timeout(env.TIMEOUT_MS))
  .get(
    "/public/search",
    zValidator("query", publicFeedSearchQuerySchema, (result, c) => {
      if (!result.success) {
        return c.json(errorResponse(result.error), 400);
      }
    }),
    async (c) => {
      const { keyword, locale, limit } = c.req.valid("query");
      const items = await searchPublicFeedsService({
        db: c.var.db,
        keyword,
        locale,
        limit,
      });
      return c.json({ items });
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

      try {
        const items = await searchFeedsService({
          db: c.var.db,
          kv: c.var.kv,
          keyword,
          model,
          locale,
          client,
        });
        return c.json(items);
      } catch (error) {
        if (error instanceof UnindexedEmbeddingModelError) {
          return c.json({ error: error.message }, 400);
        }
        if (error instanceof OllamaUnavailableError) {
          return c.json({ error: error.message }, 503);
        }
        throw error;
      }
    }
  );

export default api;
