import bootstrap from "./bootstrap";
import { env } from "./env";
import appFactory from "./factories/app.factory";
import healthRoutes from "./routes/health.route";
import indexRoutes from "./routes/index.route";
import internalRoutes from "./routes/internal.route";

/**
 * `/internal` and `/health` must be registered before the catch-all
 * better-auth handler, otherwise its wildcard swallows them. better-auth's
 * AUTH_BASE_PATH must also be `/auth` so the handler agrees with the mount.
 */
export const app = bootstrap(appFactory.createApp())
  .basePath("/auth")
  .route("/internal", internalRoutes)
  .route("/health", healthRoutes)
  .route("/", indexRoutes);

export type AuthAppRPC = typeof app;

export default {
  port: env.PORT,
  // Railway private networking is IPv6-only — bind dual-stack.
  hostname: "::",
  fetch: app.fetch,
};
