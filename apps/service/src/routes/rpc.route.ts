import { trace } from "@opentelemetry/api";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { timeout } from "hono/timeout";

import { router } from "@chia/services/router";

import { env } from "../env";
import {
  createORPCContext,
  errorStatusMap,
  withErrorReporting,
} from "../factories/orpc.factory";
import { resolveCaller } from "../guards/caller.guard";
import { rateLimiterGuard } from "../guards/rate-limiter.guard";
import { procedureOf, RPC_PREFIX } from "../utils/rpc.util";

/**
 * Chat streams and compact/navigate hold a session lock past TIMEOUT_MS; applying it here
 * 504s the response while the work continues. Paths are after `/api/v1/rpc`.
 */
const UNTIMED_PROCEDURE_PATHS = [
  "/agent/sessions/chat",
  "/agent/sessions/compact",
  "/agent/sessions/navigate",
  "/feeds/draft:watch",
];

const isUntimedProcedure = (path: string): boolean =>
  UNTIMED_PROCEDURE_PATHS.some((candidate) => path.endsWith(candidate));

/** Built once per process; holds no per-request state. */
const handler = new RPCHandler(router, {
  errorStatusMap,
  // Around the procedure call only: a body that fails to decode is oRPC's own BAD_REQUEST.
  clientInterceptors: [
    (options) => withErrorReporting(options.context, () => options.next()),
  ],
});

const requestTimeout = timeout(env.TIMEOUT_MS);

const api = new Hono<HonoContext>()
  .use((c, next) =>
    isUntimedProcedure(c.req.path) ? next() : requestTimeout(c, next)
  )
  .use(resolveCaller())
  .use(rateLimiterGuard("rpc"))
  .use("/*", async (c, next) => {
    // The server span keeps the route template; the procedure goes beside it.
    const procedure = procedureOf(c.req.path);
    if (procedure) trace.getActiveSpan()?.setAttribute("rpc.method", procedure);

    const { matched, response } = await handler.handle(c.req.raw, {
      prefix: RPC_PREFIX,
      context: createORPCContext(c),
    });

    if (matched) {
      return c.newResponse(response.body, response);
    }

    await next();
  });

export default api;
