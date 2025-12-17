import * as apikeyRoutes from "./routes/apikey.route";
import * as feedsRoutes from "./routes/feeds.route";
import * as healthRoutes from "./routes/health.route";
import { baseOS } from "./utils";

export const router = baseOS.router({
  health: {
    server: healthRoutes.healthRoute,
    client: healthRoutes.protectedHealthRoute,
  },
  apikey: {
    create: apikeyRoutes.createAPIKeyRoute,
    list: apikeyRoutes.getAllApiKeysWithMetaRoute,
    revoke: apikeyRoutes.revokeApiKeyRoute,
    delete: apikeyRoutes.deleteApiKeyRoute,
    update: apikeyRoutes.updateApiKeyRoute,
  },
  feeds: {
    list: feedsRoutes.getFeedsWithMetaRoute,
    "admin-list": feedsRoutes.getFeedsWithMetaByAdminIdRoute,
    "details-by-slug": feedsRoutes.getFeedBySlugRoute,
    "details-by-id": feedsRoutes.getFeedByIdRoute,
    create: feedsRoutes.createFeedRoute,
    update: feedsRoutes.updateFeedRoute,
    delete: feedsRoutes.deleteFeedRoute,
  },
});
