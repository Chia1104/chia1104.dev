import { Hono } from "hono";

import bootstrap from "./bootstrap";
import { env } from "./env";
import healthRoutes from "./routes/health.route";
import internalRoutes from "./routes/internal.route";

/**
 * Internal-only service: the edge gateway answers 404 for /workflow*, so
 * these routes are reachable exclusively over the private network.
 */
export const app = bootstrap(new Hono<HonoContext>())
  .basePath("/workflow")
  .route("/internal", internalRoutes)
  .route("/health", healthRoutes);

export type WorkflowAppRPC = typeof app;

export default {
  port: env.PORT,
  fetch: app.fetch,
};
