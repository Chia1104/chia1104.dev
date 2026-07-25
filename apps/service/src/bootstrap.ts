import type { Hono, Schema } from "hono";

import { bootstrap as bootstrapApp } from "@chia/service-kit/bootstrap";

import { env } from "./env";
import { getCORSAllowedOrigin } from "./utils/cors.util";

/**
 * Applies the shared service middleware with this app's env. The middleware itself
 * lives in `@chia/service-kit` so every service app boots identically.
 */
const bootstrap = <
  TSchema extends Schema,
  TApp extends Hono<HonoContext, TSchema>,
>(
  app: TApp
) =>
  bootstrapApp<HonoContext, TSchema, TApp>(app, {
    sentry: {
      dsn: env.SENTRY_DSN,
      enabled: env.NODE_ENV === "production" && !!env.ZEABUR_SERVICE_ID,
    },
    cors: {
      origin: getCORSAllowedOrigin(),
      credentials: true,
    },
    maintenance: {
      enabled: env.MAINTENANCE_MODE === "true",
      allowedPaths: ["/api/v1/health"],
      bypassToken: env.MAINTENANCE_BYPASS_TOKEN,
    },
  });

export default bootstrap;
