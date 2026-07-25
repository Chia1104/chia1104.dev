import bootstrap from "./bootstrap";
import { env } from "./env";
import appFactory from "./factories/app.factory";
import aiRoutes from "./routes/ai.route";
import authRoutes from "./routes/auth.route";
import healthRoutes from "./routes/health.route";
import openapiRoutes from "./routes/openapi.route";
import rpcRoutes from "./routes/rpc.route";
import spotifyRoutes from "./routes/spotify.route";

/**
 * `openapiRoutes` is mounted **last**: it is a catch-all that serves the oRPC router
 * over REST, so every hand-written Hono route above keeps precedence over it. That
 * ordering is what allows a Hono route to be replaced by an oRPC procedure at the same
 * URL without a flag day.
 */
export const app = bootstrap(appFactory.createApp())
  .basePath("/api/v1")
  .route("/auth", authRoutes)
  .route("/rpc", rpcRoutes)
  .route("/health", healthRoutes)
  .route("/ai", aiRoutes)
  .route("/spotify", spotifyRoutes)
  .route("/", openapiRoutes);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
