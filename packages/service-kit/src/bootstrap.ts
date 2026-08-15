import { sentry } from "@hono/sentry";
import type { Env, Hono, Schema } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { createFactory } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { createAuth } from "@chia/auth";
import { connectDatabase } from "@chia/db/client";
import { tryCatch } from "@chia/utils/error-helper";
import { errorGenerator, getClientIP } from "@chia/utils/server";

import { isAppError, toErrorResponse } from "./errors";
import type { ServiceHonoEnv } from "./hono";
import type { MaintenanceOptions } from "./middlewares/maintenance";
import { maintenance } from "./middlewares/maintenance";

/**
 * Parses a comma-separated origin list into the shape Hono's `cors` expects.
 */
export const parseAllowedOrigins = (value?: string): string[] | string => {
  if (!value) return "*";
  return value.split(",").map((item) => item.trim());
};

/**
 * Populates {@link ServiceContext} on every request. Shared by every service app so a
 * new app does not re-implement db/kv/auth wiring.
 */
export const createServiceFactory = () =>
  createFactory<ServiceHonoEnv>({
    initApp: (app) => {
      app.use(async (c, next) => {
        const [{ data: db, error: dbError }, { data: kv, error: kvError }] =
          await Promise.all([
            tryCatch(connectDatabase()),
            tryCatch(import("@chia/kv").then((m) => m.kv)),
          ]);

        if (dbError || kvError) {
          console.error(dbError, kvError);
          return c.json(errorGenerator(503), 503, {
            "Retry-After": "30",
          });
        }

        c.set("headers", c.req.raw.headers);
        c.set("clientIP", getClientIP(c.req.raw));
        c.set("db", db);
        c.set("kv", kv);
        c.set("auth", createAuth(db, kv));

        await next();
      });
    },
  });

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
   * Request body cap in bytes. Every surface parses JSON bodies, so an unbounded body is
   * an unbounded allocation.
   * @default 5 MB
   */
  maxBodySize?: number;
}

/**
 * Applies the middleware every service app shares: logging, Sentry, the global error
 * handler, the body-size cap, CORS and maintenance mode.
 *
 * The error handler is the single place HTTP error bodies are produced, so an
 * {@link AppError} thrown anywhere yields the same body the oRPC adapter produces.
 */
export const bootstrap = <
  TEnv extends Env,
  TSchema extends Schema,
  TApp extends Hono<TEnv, TSchema>,
>(
  app: TApp,
  options?: BootstrapOptions
) => {
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
    console.error(e);

    if (isAppError(e)) {
      return c.json(
        toErrorResponse(e),
        e.status as ContentfulStatusCode,
        e.headers ?? {}
      );
    }

    if (e instanceof HTTPException) {
      return c.json(errorGenerator(e.status), e.status);
    }

    c.get("sentry").captureException(e);
    return c.json(errorGenerator(500), 500);
  });

  app.use(bodyLimit({ maxSize: options?.maxBodySize ?? 5 * 1024 * 1024 }));

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
