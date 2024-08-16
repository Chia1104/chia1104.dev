import { initAuthConfig } from "@hono/auth-js";
import { sentry } from "@hono/sentry";
import type { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { getConnInfo } from "hono/bun";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { RedisStore } from "rate-limit-redis";

import { getConfig } from "@chia/auth-core";
import { createRedis } from "@chia/cache";
import { errorGenerator } from "@chia/utils";

import authRoutes from "@/controllers/auth.controller";
import feedsRoutes from "@/controllers/feeds.controller";
import healthRoutes from "@/controllers/health.controller";
import trpcRoutes from "@/controllers/trpc.controller";
import { env } from "@/env";
import { getCORSAllowedOrigin } from "@/utils/cors.util";

const bootstrap = <TContext extends HonoContext>(
  app: Hono<TContext>,
  port: number
) => {
  /**
   * logger middleware
   */
  app.use(logger());

  /**
   * CORS middleware
   */
  app.use(
    cors({
      origin: getCORSAllowedOrigin(),
      credentials: true,
    })
  );

  /**
   * Auth.js middleware
   */
  app.use(
    "*",
    initAuthConfig(() =>
      getConfig(undefined, {
        basePath: "/auth",
      })
    )
  );

  /**
   * Sentry middleware
   */
  app.use(
    "*",
    sentry({
      dsn: env.SENTRY_DSN,
      enabled: env.NODE_ENV === "production" && !!env.ZEABUR_SERVICE_ID,
    })
  );

  /**
   * Rate limiter middleware
   */
  env.NODE_ENV === "production" &&
    !!env.ZEABUR_SERVICE_ID &&
    app.use(
      rateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 87, // Limit each IP to 87 requests per `window` (here, per 15 minutes).
        standardHeaders: "draft-6", // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
        keyGenerator: (c) => {
          let info: ReturnType<typeof getConnInfo> | null = null;
          try {
            info = getConnInfo(c);
          } catch (e) {
            console.error(e);
            info = null;
          }
          return `root-request:${info?.remote.address}`;
        },
        // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
        store: new RedisStore({
          // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
          sendCommand: (...args: string[]) => createRedis().call(...args),
        }),
      })
    );

  /**
   * @TODO: customize schema
   */
  // app.use("/graphql", (c, n) =>
  //   graphqlServer({
  //     schema: buildSchema(c.var.db).schema,
  //     graphiql: true,
  //   })(c, n)
  // );

  /**
   * Global error handler
   */
  app.onError((e, c) => {
    console.error(e);
    if (e instanceof HTTPException) {
      return c.json(
        errorGenerator(e.status, [
          {
            field: e.name,
            message: e.message,
          },
        ]),
        e.status
      );
    }
    c.get("sentry").captureException(e);
    return c.json(errorGenerator(500), 500);
  });

  /**
   * Routes
   */
  app.route("/auth", authRoutes);
  app.route("/feeds", feedsRoutes);
  app.route("/trpc", trpcRoutes);
  app.route("/health", healthRoutes);

  console.log(
    `Server is running on port ${port}, go to http://localhost:${port}`
  );
};

export default bootstrap;