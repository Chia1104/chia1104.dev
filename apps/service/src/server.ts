import "zod/compile";
import bootstrap from "./bootstrap";
import { env } from "./env";
import appFactory from "./factories/app.factory";
import aiRoutes from "./routes/ai.route";
import authRoutes from "./routes/auth.route";
import healthRoutes from "./routes/health.route";
import rpcRoutes from "./routes/rpc.route";
import spotifyRoutes from "./routes/spotify.route";

export const app = bootstrap(appFactory.createApp())
  .basePath("/api/v1")
  .route("/auth", authRoutes)
  .route("/rpc", rpcRoutes)
  .route("/health", healthRoutes)
  .route("/ai", aiRoutes)
  .route("/spotify", spotifyRoutes);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
