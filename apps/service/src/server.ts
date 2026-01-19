import bootstrap from "@/bootstrap";
import { env } from "@/env";
import appFactory from "@/factories/app.factory";
import adminRoutes from "@/routes/admin.route";
import aiRoutes from "@/routes/ai.route";
import authRoutes from "@/routes/auth.route";
import emailRoutes from "@/routes/email.route";
import feedsRoutes from "@/routes/feeds.route";
import healthRoutes from "@/routes/health.route";
import rpcRoutes from "@/routes/rpc.route";
import spotifyRoutes from "@/routes/spotify.route";
import toolingsRoutes from "@/routes/toolings.route";

export const app = bootstrap(appFactory.createApp())
  .basePath("/api/v1")
  .route("/auth", authRoutes)
  .route("/admin", adminRoutes)
  .route("/feeds", feedsRoutes)
  .route("/rpc", rpcRoutes)
  .route("/health", healthRoutes)
  .route("/ai", aiRoutes)
  .route("/spotify", spotifyRoutes)
  .route("/email", emailRoutes)
  .route("/toolings", toolingsRoutes);

export type AppRPC = typeof app;

export default {
  port: env.PORT,
  fetch: app.fetch,
};
