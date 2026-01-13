import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import once from "lodash/once.js";

import { router } from "@chia/api/orpc/router";

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
      redis: c.var.redis,
      // hooks: {
      //   async onFeedCreated(feed) {
      //     if (await isOllamaEnabled(OllamaModel["nomic-embed-text"])) {
      //       if (!feed.content?.content || !feed.translation.description) {
      //         return;
      //       }
      //       const [embedding] = (
      //         await ollama.embed({
      //           model: OllamaModel["nomic-embed-text"],
      //           input: feed.content?.content ?? feed.translation.description,
      //           dimensions: 512,
      //         })
      //       ).embeddings;

      //       await upsertFeedTranslation(c.var.db, {
      //         feedId: feed.id,
      //         locale: Locale.zhTW,
      //         embedding512: embedding,
      //       });
      //     }
      //   },
      //   async onFeedUpdated(feed) {
      //     if (await isOllamaEnabled(OllamaModel["nomic-embed-text"])) {
      //       if (!feed.content?.content || !feed.translation?.description) {
      //         return;
      //       }

      //       const [embedding] = (
      //         await ollama.embed({
      //           model: OllamaModel["nomic-embed-text"],
      //           input: feed.content?.content ?? feed.translation.description,
      //           dimensions: 512,
      //         })
      //       ).embeddings;

      //       await upsertFeedTranslation(c.var.db, {
      //         feedId: feed.id,
      //         locale: Locale.zhTW,
      //         embedding512: embedding,
      //       });
      //     }
      //   },
      // },
    },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

export default api;
