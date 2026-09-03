import { createRouterClient } from "@orpc/server";
import { Hono } from "hono";

import { router } from "@chia/api/orpc/router";
import { DASH_BASE_URL } from "@chia/utils/config";

import {
  createORPCContext,
  withErrorReporting,
} from "../factories/orpc.factory";
import { verifyOperator } from "../guards/operator.guard";
import { rateLimiterGuard } from "../guards/rate-limiter.guard";

/**
 * Streamable HTTP, stateless: one server and transport per request, so any replica can
 * answer. No `timeout()`: a tool call is bounded by the procedure behind it.
 */
const api = new Hono<HonoContext>()
  .use(rateLimiterGuard({ prefix: "rate-limiter:mcp" }))
  .use(verifyOperator())
  .all("/", async (c) => {
    const [{ createMcpServer }, { StreamableHTTPTransport }] =
      await Promise.all([import("../mcp/server"), import("@hono/mcp")]);

    const context = createORPCContext(c);
    const server = createMcpServer({
      api: createRouterClient(router, {
        context,
        interceptors: [
          (options) => withErrorReporting(context, () => options.next()),
        ],
      }),
      dashBaseUrl: DASH_BASE_URL,
    });
    const transport = new StreamableHTTPTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);

    return (await transport.handleRequest(c)) ?? c.notFound();
  });

export default api;
