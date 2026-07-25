import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { timeout } from "hono/timeout";

import { registerFeedEventListeners } from "@chia/api/orpc/events";
import { router } from "@chia/api/orpc/router";

import { env } from "../env";
import {
  createORPCContext,
  withErrorReporting,
} from "../factories/orpc.factory";
import { rateLimiterGuard } from "../guards/rate-limiter.guard";
import {
  removeFeedFromSearchIndex,
  syncFeedSearchIndex,
} from "../services/feed-indexing.service";

/**
 * This app owns search indexing, so it is the one that listens for feed changes.
 * Registered once at module load rather than carried on every request context.
 */
registerFeedEventListeners({
  async onFeedChanged(feedID) {
    await syncFeedSearchIndex(feedID);
  },
  async onFeedRemoved(translationIDs) {
    await removeFeedFromSearchIndex(translationIDs);
  },
});

/** Built once per process — the handler holds no per-request state. */
const handler = new RPCHandler(router, {
  interceptors: [
    (options) => withErrorReporting(options.context, () => options.next()),
  ],
});

const api = new Hono<HonoContext>()
  .use(timeout(env.TIMEOUT_MS))
  .use(
    rateLimiterGuard({
      prefix: "rate-limiter:rpc",
    })
  )
  .use("/*", async (c, next) => {
    const { matched, response } = await handler.handle(c.req.raw, {
      prefix: "/api/v1/rpc",
      context: createORPCContext(c),
    });

    if (matched) {
      return c.newResponse(response.body, response);
    }

    await next();
  });

export default api;
