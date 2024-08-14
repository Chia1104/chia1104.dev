import { initAuthConfig } from "@hono/auth-js";
import { serve } from "@hono/node-server";
import { sentry } from "@hono/sentry";
import { getRuntimeKey } from "hono/adapter";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";

import { getConfig } from "@chia/auth-core";
import { errorGenerator } from "@chia/utils";

import authRoutes from "@/controllers/auth.controller";
import feedsRoutes from "@/controllers/feeds.controller";
import healthRoutes from "@/controllers/health.controller";
import trpcRoutes from "@/controllers/trpc.controller";
import { env } from "@/env";
import drizzleFactory from "@/factories/drizzle.factory";
import { getCORSAllowedOrigin } from "@/utils/cors.util";

export const app = drizzleFactory.createApp();

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
  sentry({
    dsn: env.SENTRY_DSN,
    enabled: env.NODE_ENV === "production" && !!env.ZEABUR_SERVICE_ID,
  })
);

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

app.route("/auth", authRoutes);
app.route("/feeds", feedsRoutes);
app.route("/trpc", trpcRoutes);
app.route("/health", healthRoutes);

const port = Number(process.env.PORT) || 3005;
console.log(
  `Server is running on port ${port}, go to http://localhost:${port}`
);

if (getRuntimeKey() === "node") {
  serve({
    fetch: app.fetch,
    port,
  });
}

export default {
  fetch: app.fetch,
  port,
};
