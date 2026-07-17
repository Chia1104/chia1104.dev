import { sentry } from "@hono/sentry";
import type { Hono, Schema } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";

import { errorGenerator } from "@chia/utils/server";

import { env } from "./env";

const bootstrap = <
  TContext extends HonoContext,
  TSchema extends Schema,
  TApp extends Hono<TContext, TSchema>,
>(
  app: TApp
) => {
  /**
   * logger middleware
   */
  app.use(logger());

  /**
   * Sentry middleware
   */
  app.use(
    sentry({
      dsn: env.SENTRY_DSN,
      enabled: env.NODE_ENV === "production" && !!env.ZEABUR_SERVICE_ID,
    })
  );

  /**
   * Global error handler
   */
  app.onError((e, c) => {
    console.error(e);
    if (e instanceof HTTPException) {
      return c.json(errorGenerator(e.status), e.status);
    }
    c.get("sentry").captureException(e);
    return c.json(errorGenerator(500), 500);
  });

  return app;
};

export default bootstrap;
