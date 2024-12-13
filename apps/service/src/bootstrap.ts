import { initAuthConfig } from "@hono/auth-js";
import { sentry } from "@hono/sentry";
import type { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ipRestriction } from "hono/ip-restriction";
import { logger } from "hono/logger";
import { RedisStore } from "rate-limit-redis";

import { getConfig } from "@chia/auth-core";
import { createRedis } from "@chia/cache";
import { errorGenerator } from "@chia/utils";

import adminRoutes from "@/controllers/admin.controller";
import aiRoutes from "@/controllers/ai.controller";
import authRoutes from "@/controllers/auth.controller";
import feedsRoutes from "@/controllers/feeds.controller";
import healthRoutes from "@/controllers/health.controller";
import spotifyRoutes from "@/controllers/spotify.controller";
import trpcRoutes from "@/controllers/trpc.controller";
import { env } from "@/env";
import { getCORSAllowedOrigin } from "@/utils/cors.util";

import { splitString } from "./utils";

const bootstrap = async <TContext extends HonoContext>(
  app: Hono<TContext>,
  port: number
) => {
  /**
   * logger middleware
   */
  app.use(logger());

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

  /**
   * CORS middleware
   */
  app.use(
    cors({
      origin: getCORSAllowedOrigin(),
      credentials: true,
    })
  );

  app.use(
    ipRestriction(
      (c) =>
        c.req.raw.headers.get("X-Forwarded-For")?.split(",")[0] ??
        c.req.raw.headers.get("X-Real-IP") ??
        "anonymous",
      {
        denyList: splitString(env.IP_DENY_LIST),
        allowList: splitString(env.IP_ALLOW_LIST),
      }
    )
  );

  /**
   * Rate limiter middleware
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  env.NODE_ENV === "production" &&
    !!env.ZEABUR_SERVICE_ID &&
    app.use(
      rateLimiter({
        windowMs: env.RATELIMIT_WINDOW_MS,
        limit: env.RATELIMIT_MAX,
        standardHeaders: "draft-6", // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
        keyGenerator: (c) => {
          let info: string | null | undefined = null;
          try {
            info =
              c.req.raw.headers.get("X-Forwarded-For")?.split(",")[0] ??
              c.req.raw.headers.get("X-Real-IP") ??
              "anonymous";
          } catch (e) {
            console.error(e);
            info = null;
          }
          console.log(`root-request:${info}`);
          return `root-request:${info}`;
        },
        // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
        store: new RedisStore({
          // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
          sendCommand: (...args: string[]) => createRedis().call(...args),
        }),
      })
    );

  const authConfig = await getConfig(undefined, {
    basePath: "/api/v1/auth",
  });
  /**
   * Auth.js middleware
   */
  app.use(
    "*",
    initAuthConfig(() => authConfig)
  );
  /**
   * Routes
   */
  app.route("/api/v1/auth", authRoutes);
  app.route("/api/v1/admin", adminRoutes);
  app.route("/api/v1/feeds", feedsRoutes);
  app.route("/api/v1/trpc", trpcRoutes);
  app.route("/api/v1/health", healthRoutes);
  app.route("/api/v1/ai", aiRoutes);
  app.route("/api/v1/spotify", spotifyRoutes);

  console.log(
    `Server is running on port ${port}, go to http://localhost:${port}`
  );
};

export default bootstrap;
