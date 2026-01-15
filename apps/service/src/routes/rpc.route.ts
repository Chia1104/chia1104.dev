import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import once from "lodash/once.js";
import { start } from "workflow/api";

import { router } from "@chia/api/orpc/router";

import { feedEmbeddingsWorkflow } from "../workflows/feed-embeddings.workflow.js";

const api = new Hono<HonoContext>();

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
          await start(feedEmbeddingsWorkflow, [
            {
              feedID: feed.id,
              locale: feed.translation.locale,
              content:
                feed.content?.content ?? feed.translation.description ?? "",
              enabled: feed.published,
            },
          ]);
        },

        async onFeedUpdated(feed) {
          await start(feedEmbeddingsWorkflow, [
            {
              feedID: feed.id,
              locale: feed.translation?.locale,
              content:
                feed.content?.content ?? feed.translation?.description ?? "",
              enabled: feed.published,
            },
          ]);
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
