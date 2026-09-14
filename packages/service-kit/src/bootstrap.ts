import { sentry } from "@hono/sentry";
import type { Env, Hono, Schema } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { errorGenerator } from "@chia/utils/server";

import { isAppError, toErrorResponse } from "./errors";
import { bodyLimit } from "./middlewares/body-limit";
import type { MaintenanceOptions } from "./middlewares/maintenance";
import { maintenance } from "./middlewares/maintenance";

export const parseAllowedOrigins = (value?: string): string[] | string => {
  if (!value) return "*";
  return value.split(",").map((item) => item.trim());
};

export interface BootstrapOptions {
  sentry?: {
    dsn?: string;
    enabled?: boolean;
  };
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
  maintenance?: MaintenanceOptions;
  /**
   * @default true
   */
  logger?: boolean;
  /**
   * Request body cap in bytes.
   * @default 5 MB
   */
  maxBodySize?: number;
}

/** Shared middleware: request id, logging, Sentry, errors, body cap, CORS, maintenance. */
export const bootstrap = <
  TEnv extends Env,
  TSchema extends Schema,
  TApp extends Hono<TEnv, TSchema>,
>(
  app: TApp,
  options?: BootstrapOptions
) => {
  app.use(requestId());

  if (options?.logger !== false) {
    app.use(logger());
  }

  app.use(
    sentry({
      dsn: options?.sentry?.dsn,
      enabled: options?.sentry?.enabled ?? false,
    })
  );

  app.onError((e, c) => {
    const status = isAppError(e) || e instanceof HTTPException ? e.status : 500;

    // A 4xx answers the caller; only this service's own failures are logged and reported.
    if (status >= 500) {
      const id = c.get("requestId");
      console.error("Request failed", { requestId: id, error: e });
      c.get("sentry").setTag("requestId", id);
      c.get("sentry").captureException(e);
    }

    if (isAppError(e)) {
      return c.json(
        toErrorResponse(e),
        /* SAFETY: The producer contract guarantees this value satisfies ContentfulStatusCode. */ e.status as ContentfulStatusCode,
        e.headers ?? {}
      );
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
