import "zod/compile";
import { Hono } from "hono";

import { bootstrap } from "@chia/service-kit/bootstrap";

import { env } from "./env";
import workflowControlRoutes from "./workflow-control.route";

export const app = bootstrap(new Hono(), {
  sentry: {
    dsn: env.SENTRY_DSN,
    enabled: env.NODE_ENV === "production",
  },
})
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/", workflowControlRoutes);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
