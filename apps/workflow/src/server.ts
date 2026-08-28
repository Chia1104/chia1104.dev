import { Hono } from "hono";

import { env } from "./env";
import workflowControlRoutes from "./workflow-control.route";

export const app = new Hono()
  .basePath("/api/v1")
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/internal/workflow", workflowControlRoutes);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
