import { initAuthConfig } from "@hono/auth-js";
import { serve } from "@hono/node-server";
import { sentry } from "@hono/sentry";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { getConfig } from "@chia/auth-core-esm";
import { db, localDb, betaDb } from "@chia/db";
import { getDb } from "@chia/utils";

import authRoutes from "@/controllers/auth.controller";
import feedsRoutes from "@/controllers/feeds.controller";
import { env } from "@/env";
import { initDrizzleORM } from "@/middlewares/drizzle.middleware";
import { getCORSAllowedOrigin } from "@/utils/cors.util";

const app = new Hono<HonoContext>();

app.use(logger());
app.use(
  cors({
    origin: getCORSAllowedOrigin(),
    credentials: true,
    allowHeaders: ["content-type"],
    allowMethods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    exposeHeaders: ["retry-after"],
  })
);

app.use(
  "*",
  initAuthConfig(() =>
    getConfig(undefined, {
      basePath: "/auth",
    })
  )
);

app.use(
  "*",
  initDrizzleORM(
    getDb(undefined, {
      db,
      betaDb,
      localDb,
    })
  )
);

app.use(
  "*",
  sentry({
    dsn: env.SENTRY_DSN,
    enabled: env.NODE_ENV === "production" && !!env.ZEABUR_SERVICE_ID,
  })
);

app.onError((e, c) => {
  console.error(e);
  c.get("sentry").captureException(e);
  return c.text("Internal Server Error", 500);
});

app.route("/auth", authRoutes);
app.route("/feeds", feedsRoutes);

const port = Number(process.env.PORT) || 3005;
console.log(
  `Server is running on port ${port}, go to http://localhost:${port}`
);

serve({
  fetch: app.fetch,
  port,
});
