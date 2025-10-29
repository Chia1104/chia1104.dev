import { sentry } from "@hono/sentry";
import type { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ipRestriction } from "hono/ip-restriction";
import { logger } from "hono/logger";
import { timeout } from "hono/timeout";

import { auth } from "@chia/auth";
import { errorGenerator } from "@chia/utils";
import { getClientIP } from "@chia/utils/get-client-ip";

import adminRoutes from "@/controllers/admin.controller";
import aiRoutes from "@/controllers/ai.controller";
import authRoutes from "@/controllers/auth.controller";
import emailRoutes from "@/controllers/email.controller";
import feedsRoutes from "@/controllers/feeds.controller";
import healthRoutes from "@/controllers/health.controller";
import spotifyRoutes from "@/controllers/spotify.controller";
import toolingsRoutes from "@/controllers/toolings.controller";
import triggerRoutes from "@/controllers/trigger.controller";
import trpcRoutes from "@/controllers/trpc.controller";
import { env } from "@/env";
import { maintenance } from "@/middlewares/maintenance.middleware";
import { getCORSAllowedOrigin } from "@/utils/cors.util";

import { splitString } from "./utils";

const bootstrap = <TContext extends HonoContext>(
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
  // app.use(
  //   rateLimiter({
  //     windowMs: env.RATELIMIT_WINDOW_MS,
  //     limit: env.RATELIMIT_MAX,
  //     standardHeaders: "draft-6", // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  //     keyGenerator: (c) => {
  //       let info: string | null | undefined = null;
  //       try {
  //         info = getClientIP(c.req.raw);
  //       } catch (e) {
  //         console.error(e);
  //         info = null;
  //       }
  //       console.log(`root-request:${info}`);
  //       return `root-request:${info}`;
  //     },
  //   })
  // );

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
  app
    .use("/api/v1/auth", timeout(env.TIMEOUT_MS))
    .route("/api/v1/auth", authRoutes);
  app
    .use("/api/v1/admin", timeout(env.TIMEOUT_MS))
    .route("/api/v1/admin", adminRoutes);
  app
    .use("/api/v1/feeds", timeout(env.TIMEOUT_MS))
    .route("/api/v1/feeds", feedsRoutes);
  app
    .use("/api/v1/trpc", timeout(env.TIMEOUT_MS))
    .route("/api/v1/trpc", trpcRoutes);
  app
    .use("/api/v1/health", timeout(env.TIMEOUT_MS))
    .route("/api/v1/health", healthRoutes);
  app.route("/api/v1/ai", aiRoutes);
  app
    .use("/api/v1/spotify", timeout(env.TIMEOUT_MS))
    .route("/api/v1/spotify", spotifyRoutes);
  app
    .use("/api/v1/email", timeout(env.TIMEOUT_MS))
    .route("/api/v1/email", emailRoutes);
  app
    .use("/api/v1/trigger", timeout(env.TIMEOUT_MS))
    .route("/api/v1/trigger", triggerRoutes);
  app
    .use("/api/v1/toolings", timeout(env.TIMEOUT_MS))
    .route("/api/v1/toolings", toolingsRoutes);
  console.log(
    `Server is running on port ${port}, go to http://localhost:${port}`
  );
};

export default bootstrap;
