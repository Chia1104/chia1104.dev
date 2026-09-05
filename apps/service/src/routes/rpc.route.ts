import { COMMON_ERROR_STATUS_MAP } from "@orpc/server";
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
  // QUOTA_EXCEEDED is the only AppError code outside oRPC's common codes.
  errorStatusMap: { ...COMMON_ERROR_STATUS_MAP, QUOTA_EXCEEDED: 402 },
  interceptors: [
    (options) => withErrorReporting(options.context, () => options.next()),
  ],
});

const requestTimeout = timeout(env.TIMEOUT_MS);

const api = new Hono<HonoContext>()
  .use((c, next) =>
    isUntimedProcedure(c.req.path) ? next() : requestTimeout(c, next)
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
