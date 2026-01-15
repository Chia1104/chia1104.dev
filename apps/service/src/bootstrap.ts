import { sentry } from "@hono/sentry";
import type { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ipRestriction } from "hono/ip-restriction";
import { logger } from "hono/logger";

import { getClientIP, errorGenerator } from "@chia/utils/server";

import { env } from "@/env";
import { maintenance } from "@/middlewares/maintenance.middleware";
import adminRoutes from "@/routes/admin.route";
import aiRoutes from "@/routes/ai.route";
import authRoutes from "@/routes/auth.route";
import emailRoutes from "@/routes/email.route";
import feedsRoutes from "@/routes/feeds.route";
import healthRoutes from "@/routes/health.route";
import rpcRoutes from "@/routes/rpc.route";
import spotifyRoutes from "@/routes/spotify.route";
import toolingsRoutes from "@/routes/toolings.route";
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
   * Routes
   */
  app.route("/api/v1/auth", authRoutes);
  app.route("/api/v1/admin", adminRoutes);
  app.route("/api/v1/feeds", feedsRoutes);
  app.route("/api/v1/rpc", rpcRoutes);
  app.route("/api/v1/health", healthRoutes);
  app.route("/api/v1/ai", aiRoutes);
  app.route("/api/v1/spotify", spotifyRoutes);
  app.route("/api/v1/email", emailRoutes);
  app.route("/api/v1/toolings", toolingsRoutes);

  console.log(
    `Server is running on port ${port}, go to http://localhost:${port}`
  );
};

export default bootstrap;
