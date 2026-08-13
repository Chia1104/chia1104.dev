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
import { registerAgentKindServices } from "../services/agent.service";
import {
  removeFeedFromSearchIndex,
  syncFeedSearchIndex,
} from "../services/feed-indexing.service";
import { registerRagIndexingService } from "../services/rag-indexing.service";

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

/**
 * This app also owns the agent runtime: running a turn needs a long-lived process, a database
 * handle and the gateway credentials, none of which `packages/api` has. Same registration shape as
 * the feed listeners above.
 */
registerAgentKindServices();

/**
 * The RAG triggers land here for the same reason: `start()` and the lazy reconcile that
 * reads a run's real status both need the workflow runtime. Registering beside the router
 * that serves those procedures is what keeps a call from another process an explicit
 * `SERVICE_UNAVAILABLE` instead of a trigger that silently never ran.
 */
registerRagIndexingService();

/**
 * Procedures whose response *is* a live event stream, so the shared request timeout must not apply.
 *
 * Only the stream endpoint needs this. `agent.sessions.prompt` used to as well, but the turn now
 * runs inside a durable workflow run — so `prompt` returns as soon as the message is enqueued and
 * keeps the normal timeout.
 *
 * Matched against the oRPC procedure path (`/agent/sessions/stream`), which is what appears after
 * the `/api/v1/rpc` mount prefix.
 */
const STREAMING_PROCEDURE_PATHS = ["/agent/sessions/stream"];

const isStreamingProcedure = (path: string): boolean =>
  STREAMING_PROCEDURE_PATHS.some((candidate) => path.endsWith(candidate));

/** Built once per process — the handler holds no per-request state. */
const handler = new RPCHandler(router, {
  interceptors: [
    (options) => withErrorReporting(options.context, () => options.next()),
  ],
});

const requestTimeout = timeout(env.TIMEOUT_MS);

const api = new Hono<HonoContext>()
  .use((c, next) =>
    isStreamingProcedure(c.req.path) ? next() : requestTimeout(c, next)
  )
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
