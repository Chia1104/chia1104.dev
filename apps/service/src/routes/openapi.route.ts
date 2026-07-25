import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { timeout } from "hono/timeout";

import { routerContract } from "@chia/api/orpc/contracts";
import { router } from "@chia/api/orpc/router";
import meta from "@chia/meta";

import { env } from "../env";
import { toLegacyErrorBody } from "../factories/orpc-error.factory";
import {
  createORPCContext,
  withErrorReporting,
} from "../factories/orpc.factory";
import { rateLimiterGuard } from "../guards/rate-limiter.guard";

export const OPENAPI_PREFIX = "/api/v1";

/**
 * REST view over the same oRPC router the `/rpc` surface serves.
 *
 * Procedures that declare `.route({ method, path })` are reachable at that URL;
 * everything else falls back to oRPC's default `POST /<router path>`. This is what lets
 * a Hono route be replaced by a procedure without its public URL changing.
 *
 * Shares its interceptors with the RPC handler, so both surfaces emit the same error
 * bodies.
 */
const handler = new OpenAPIHandler(router, {
  interceptors: [
    (options) => withErrorReporting(options.context, () => options.next()),
  ],
  rootInterceptors: [
    async (options) => {
      const result = await options.next();

      if (!result.matched || result.response.status < 400) {
        return result;
      }

      return {
        ...result,
        response: {
          ...result.response,
          body: toLegacyErrorBody(result.response.body, result.response.status),
        },
      };
    },
  ],
});

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

/** Generated from the contract, once per process. */
let spec: Promise<unknown> | undefined;

const getSpec = () =>
  (spec ??= generator.generate(routerContract, {
    info: {
      title: `${meta.name} Service API`,
      version: "1.0.0",
    },
    servers: [{ url: OPENAPI_PREFIX }],
  }));

const api = new Hono<HonoContext>()
  .use(timeout(env.TIMEOUT_MS))
  .get("/openapi.json", async (c) => c.json((await getSpec()) as object))
  .use(
    rateLimiterGuard({
      prefix: "rate-limiter:openapi",
    })
  )
  .use("/*", async (c, next) => {
    const { matched, response } = await handler.handle(c.req.raw, {
      prefix: OPENAPI_PREFIX,
      context: createORPCContext(c),
    });

    if (matched) {
      return c.newResponse(response.body, response);
    }

    await next();
  });

export default api;
