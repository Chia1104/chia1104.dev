import "zod/compile";
import { Hono } from "hono";

import { env } from "./env";
import workflowControlRoutes from "./workflow-control.route";

export const app = new Hono()
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/", workflowControlRoutes);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
