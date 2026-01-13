import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { TaskID } from "trigger/constant";
import * as z from "zod";

import { tryCatch } from "@chia/utils/error-helper";
import { errorGenerator } from "@chia/utils/server";

import { env } from "@/env";
import { apikeyVerify } from "@/guards/apikey-verify.guard";
import { errorResponse } from "@/utils/error.util";

const api = new Hono<HonoContext>();

api.use(
  "*",
  apikeyVerify({
    projectId: env.PROJECT_ID,
  })
);

api.post(
  "/:id",
  zValidator(
    "param",
    z.object({
      id: z.enum(TaskID),
    }),
    (result, c) => {
      if (!result.success) {
        return c.json(errorResponse(result.error), 400);
      }
    }
  ),
  async (c) => {
    const id = c.req.valid("param").id;
    switch (id) {
      case TaskID.FeedSummarize: {
        const feedSummarizeRequestSchema =
          await import("trigger/feed-summarize").then((m) => m.requestSchema);
        const feedSummarizeTask = await import("trigger/feed-summarize").then(
          (m) => m.feedSummarizeTask
        );
        const { data: dto, error } = await tryCatch(
          feedSummarizeRequestSchema.parse(await c.req.json())
        );
        if (error) {
          if (error instanceof z.ZodError) {
            return c.json(errorResponse(error), 400);
          }
          c.var.sentry.captureException(error);
          return c.json(errorGenerator(500), 500);
        }
        await feedSummarizeTask.trigger(dto);
        return c.json(null);
      }
      case TaskID.FeedEmbeddings: {
        const feedEmbeddingsRequestSchema =
          await import("trigger/feed-embeddings").then((m) => m.requestSchema);
        const feedEmbeddingsTask = await import("trigger/feed-embeddings").then(
          (m) => m.feedEmbeddingsTask
        );
        const { data: dto, error } = await tryCatch(
          feedEmbeddingsRequestSchema.parse(await c.req.json())
        );
        if (error) {
          if (error instanceof z.ZodError) {
            return c.json(errorResponse(error), 400);
          }
          c.var.sentry.captureException(error);
          return c.json(errorGenerator(500), 500);
        }
        await feedEmbeddingsTask.trigger(dto);
        return c.json(null);
      }
      default:
        return c.json(errorGenerator(400), 400);
    }
  }
);

export default api;
