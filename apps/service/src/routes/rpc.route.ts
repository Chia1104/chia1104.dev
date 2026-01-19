import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { all } from "better-all";
import { Hono } from "hono";
import { timeout } from "hono/timeout";
import once from "lodash/once.js";
import { start } from "workflow/api";

import { router } from "@chia/api/orpc/router";

import { env } from "@/env";
import { rateLimiterGuard } from "@/guards/rate-limiter.guard";

import { estimateReadingTimeWorkflow } from "../workflows/estimate-reading-time.workflow.js";
import { feedEmbeddingsWorkflow } from "../workflows/feed-embeddings.workflow.js";

const api = new Hono<HonoContext>();

api.use(timeout(env.TIMEOUT_MS));
api.use(
  rateLimiterGuard({
    prefix: "rate-limiter:rpc",
  })
);

api.use("/*", async (c, next) => {
  const handler = once(
    () =>
      new RPCHandler(router, {
        interceptors: [
          onError((error) => {
            console.error(error);
            c.get("sentry").captureException(error);
          }),
        ],
      })
  );
  const { matched, response } = await handler().handle(c.req.raw, {
    prefix: "/api/v1/rpc",
    context: {
      headers: c.req.raw.headers,
      db: c.var.db,
      kv: c.var.kv,
      hooks: {
        async onFeedCreated(feed) {
          await all({
            async feedEmbeddings() {
              return await start(feedEmbeddingsWorkflow, [
                {
                  feedID: feed.id,
                  locale: feed.translation.locale,
                  content:
                    feed.content?.content ?? feed.translation.description ?? "",
                  enabled: feed.published,
                },
              ]);
            },
            async estimateReadingTime() {
              return await start(estimateReadingTimeWorkflow, [
                {
                  feedID: feed.id,
                  locale: feed.translation.locale,
                  content:
                    feed.content?.content ?? feed.translation.description ?? "",
                },
              ]);
            },
          });
        },

        async onFeedUpdated(feed) {
          await all({
            async feedEmbeddings() {
              return await start(feedEmbeddingsWorkflow, [
                {
                  feedID: feed.id,
                  locale: feed.translation?.locale,
                  content:
                    feed.content?.content ??
                    feed.translation?.description ??
                    "",
                  enabled: feed.published,
                },
              ]);
            },
            async estimateReadingTime() {
              return await start(estimateReadingTimeWorkflow, [
                {
                  feedID: feed.id,
                  locale: feed.translation?.locale,
                  content:
                    feed.content?.content ??
                    feed.translation?.description ??
                    "",
                },
              ]);
            },
          });
        },
      },
    },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

export default api;
