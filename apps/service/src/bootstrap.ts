import { sentry } from "@hono/sentry";
import type { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ipRestriction } from "hono/ip-restriction";
import { logger } from "hono/logger";
import { timeout } from "hono/timeout";
import { RedisStore } from "rate-limit-redis";

import { auth } from "@chia/auth";
import { createRedis } from "@chia/cache";
import { errorGenerator } from "@chia/utils";

import adminRoutes from "@/controllers/admin.controller";
import aiRoutes from "@/controllers/ai.controller";
import authRoutes from "@/controllers/auth.controller";
import emailRoutes from "@/controllers/email.controller";
import feedsRoutes from "@/controllers/feeds.controller";
import healthRoutes from "@/controllers/health.controller";
import spotifyRoutes from "@/controllers/spotify.controller";
import trpcRoutes from "@/controllers/trpc.controller";
import { env } from "@/env";
import { maintenance } from "@/middlewares/maintenance.middleware";
import { getCORSAllowedOrigin } from "@/utils/cors.util";

import { splitString, getClientIP } from "./utils";

const bootstrap = <TContext extends HonoContext>(
  app: Hono<TContext>,
  port: number
) => {
  app.use("*", timeout(env.TIMEOUT_MS));
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
   * Maintenance mode middleware
   */
  app.use(
    "*",
    maintenance({
      enabled: env.MAINTENANCE_MODE === "true",
      allowedPaths: ["/api/v1/health"],
      bypassToken: env.MAINTENANCE_BYPASS_TOKEN,
    })
  );

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
    ipRestriction((c) => getClientIP(c.req.raw), {
      denyList: splitString(env.IP_DENY_LIST),
      allowList: splitString(env.IP_ALLOW_LIST),
    })
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

  /**
   * better-auth middleware
   */
  app.use("*", async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      c.set("user", null);
      c.set("session", null);
      return next();
    }

    c.set("user", session.user);
    c.set("session", session.session);
    return next();
  });

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
  app.route("/api/v1/email", emailRoutes);

  console.log(
    `Server is running on port ${port}, go to http://localhost:${port}`
  );
};

export default bootstrap;
