import bootstrap from "./bootstrap";
import { env } from "./env";
import appFactory from "./factories/app.factory";
import aiRoutes from "./routes/ai.route";
import healthRoutes from "./routes/health.route";

/**
 * `/health` must be registered before the AI routes so their guards
 * (rate limiter, verifyAuth) don't apply to it. `/ai/internal/*` is reserved
 * for future server-to-server routes and is blocked at the gateway.
 */
export const app = bootstrap(appFactory.createApp())
  .basePath("/ai")
  .route("/health", healthRoutes)
  .route("/", aiRoutes);

export type AIAppRPC = typeof app;

export default {
  port: env.PORT,
  // Railway private networking is IPv6-only — bind dual-stack.
  hostname: "::",
  fetch: app.fetch,
};
