import * as apikeyRoutes from "./routes/apikey.route";
import * as feedsRoutes from "./routes/feeds.route";
import * as fileRoutes from "./routes/file.route";
import * as healthRoutes from "./routes/health.route";
import * as organizationRoutes from "./routes/organization.route";
import { baseOS } from "./utils";

export const router = baseOS.router({
  health: {
    server: healthRoutes.healthRoute,
    client: healthRoutes.protectedHealthRoute,
  },
  apikey: {
    create: apikeyRoutes.createAPIKeyRoute,
    list: apikeyRoutes.getAllApiKeysWithMetaRoute,
    "project-list": apikeyRoutes.getProjectApiKeysRoute,
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
  organization: {
    details: organizationRoutes.getOrganizationRoute,
    create: organizationRoutes.createOrganizationRoute,
    delete: organizationRoutes.deleteOrganizationRoute,
    projects: {
      create: organizationRoutes.createProjectRoute,
      "details-by-id": organizationRoutes.getProjectByIdRoute,
      "details-by-slug": organizationRoutes.getProjectBySlugRoute,
      list: organizationRoutes.getInfiniteProjectsRoute,
    },
  },
  file: {
    "signed-url:create": fileRoutes.createSignedUrlForUploadRoute,
  },
});
