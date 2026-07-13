import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { timeout } from "hono/timeout";
import once from "lodash/once.js";

import { router } from "@chia/api/orpc/router";

import { env } from "../env";
import { rateLimiterGuard } from "../guards/rate-limiter.guard";
import {
  removeFeedFromSearchIndex,
  syncFeedSearchIndex,
} from "../services/feed-indexing.service";

const api = new Hono<HonoContext>()
  .use(timeout(env.TIMEOUT_MS))
  .use(
    rateLimiterGuard({
      prefix: "rate-limiter:rpc",
    })
  )
  .use("/*", async (c, next) => {
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
        auth: c.var.auth,
        hooks: {
          async onFeedChanged(feedID) {
            await syncFeedSearchIndex(c.var.db, feedID);
          },
          async onFeedRemoved(translationIDs) {
            await removeFeedFromSearchIndex(translationIDs);
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
