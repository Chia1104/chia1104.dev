import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { timeout } from "hono/timeout";

import { router } from "@chia/api/orpc/router";

import { env } from "../env";
import {
  createORPCContext,
  withErrorReporting,
} from "../factories/orpc.factory";
import { rateLimiterGuard } from "../guards/rate-limiter.guard";

/**
 * Procedures whose response *is* a live event stream, so the shared request timeout must not apply.
 *
 * Matched against the oRPC procedure path (`/agent/sessions/chat`), which is what appears after
 * the `/api/v1/rpc` mount prefix.
 */
const STREAMING_PROCEDURE_PATHS = ["/agent/sessions/chat"];

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
