import { httpInstrumentationMiddleware } from "@hono/otel";
import { trace } from "@opentelemetry/api";
import { setTag } from "@sentry/node-core/light";
import type { Context, Env, Hono, Schema } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";
import { routePath } from "hono/route";

import { logger } from "@chia/observability/logger";
import type { LogFields } from "@chia/observability/logger";
import { reportError } from "@chia/observability/report";
import { errorGenerator } from "@chia/utils/server";

import { isAppError, toErrorResponse } from "./errors";
import { bodyLimit } from "./middlewares/body-limit";
import type { MaintenanceOptions } from "./middlewares/maintenance";
import { maintenance } from "./middlewares/maintenance";

export const parseAllowedOrigins = (value?: string): string[] | string => {
  if (!value) return "*";
  return value.split(",").map((item) => item.trim());
};

const contentLength = (value: string | null | undefined) => {
  const bytes = Number(value);
  return value && Number.isFinite(bytes) ? bytes : undefined;
};

export interface BootstrapOptions<TEnv extends Env = Env> {
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
  maintenance?: MaintenanceOptions;
  /**
   * Logs one line per request.
   * @default true
   */
  logger?: boolean;
  /** App-specific fields for the request log line, read after the handler has run. */
  requestLogFields?: (c: Context<TEnv>) => LogFields;
  /**
   * Request body cap in bytes.
   * @default 5 MB
   */
  maxBodySize?: number;
}

/** Shared middleware: server span, request id, request log, errors, body cap, CORS, maintenance. */
export const bootstrap = <
  TEnv extends Env,
  TSchema extends Schema,
  TApp extends Hono<TEnv, TSchema>,
>(
  app: TApp,
  options?: BootstrapOptions<TEnv>
) => {
  // Server span first, so everything after it (the error handler included) runs inside it.
  app.use(httpInstrumentationMiddleware());
  app.use(requestId());
  app.use(async (c, next) => {
    const id = c.get("requestId");
    trace.getActiveSpan()?.setAttribute("request.id", id);
    // Sentry forks an isolation scope per incoming request, so the tag stays on this one.
    setTag("request.id", id);
    await next();
  });

  if (options?.logger !== false) {
    app.use(async (c, next) => {
      const start = performance.now();
      await next();
      const { status } = c.res;
      const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      // Path without the query string, which can carry OAuth codes and tokens.
      logger[level](
        {
          ...options?.requestLogFields?.(c),
          requestId: c.get("requestId"),
          method: c.req.method,
          route: routePath(c),
          path: c.req.path,
          status,
          // Until the handler returns: a streamed body is still being written.
          durationMs: Math.round(performance.now() - start),
          requestBytes: contentLength(c.req.header("content-length")),
          responseBytes: contentLength(c.res.headers.get("content-length")),
          userAgent: c.req.header("user-agent"),
        },
        "request"
      );
    });
  }

  app.onError((e, c) => {
    const status = isAppError(e) || e instanceof HTTPException ? e.status : 500;

    // A 4xx answers the caller; only this service's own failures are logged and reported.
    if (status >= 500) {
      reportError(e, "Request failed", { requestId: c.get("requestId") });
    }

    if (isAppError(e)) {
      return c.json(toErrorResponse(e), e.status, e.headers ?? {});
    }

    if (e instanceof HTTPException) {
      return c.json(errorGenerator(e.status), e.status);
    }

    return c.json(errorGenerator(500), 500);
  });

  app.use(bodyLimit(options?.maxBodySize ?? 5 * 1024 * 1024));

  // CORS before maintenance: a maintenance 503 (including the preflight answer) must
  // carry CORS headers, or a browser client sees an opaque CORS failure instead.
  if (options?.cors) {
    app.use(
      cors({
        origin: options.cors.origin,
        credentials: options.cors.credentials,
      })
    );
  }

  app.use(maintenance(options?.maintenance));

  return app;
};
