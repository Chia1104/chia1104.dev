import * as apikeyContracts from "./contracts/apikey.contract";
import * as feedsContracts from "./contracts/feeds.contract";
import * as fileContracts from "./contracts/file.contract";
import * as healthContracts from "./contracts/health.contract";
import * as organizationContracts from "./contracts/organization.contract";
import * as userContracts from "./contracts/user.contract";

export const routerContract = {
  health: {
    server: healthContracts.healthContract,
    client: healthContracts.protectedHealthContract,
  },
  apikey: {
    create: apikeyContracts.createAPIKeyContract,
    list: apikeyContracts.getAllApiKeysWithMetaContract,
    "project-list": apikeyContracts.getProjectApiKeysContract,
    revoke: apikeyContracts.revokeApiKeyContract,
    delete: apikeyContracts.deleteApiKeyContract,
    update: apikeyContracts.updateApiKeyContract,
  },
  user: {
    "profile:update": userContracts.updateUserProfileContract,
  },
  feeds: {
    list: feedsContracts.getFeedsWithMetaContract,
    "admin-list": feedsContracts.getFeedsWithMetaByAdminIdContract,
    "details-by-slug": feedsContracts.getFeedBySlugContract,
    "details-by-id": feedsContracts.getFeedByIdContract,
    create: feedsContracts.createFeedContract,
    update: feedsContracts.updateFeedContract,
    delete: feedsContracts.deleteFeedContract,
  },
  organization: {
    details: organizationContracts.getOrganizationContract,
    create: organizationContracts.createOrganizationContract,
    delete: organizationContracts.deleteOrganizationContract,
    projects: {
      create: organizationContracts.createProjectContract,
      "details-by-id": organizationContracts.getProjectByIdContract,
      "details-by-slug": organizationContracts.getProjectBySlugContract,
      list: organizationContracts.getInfiniteProjectsContract,
    },
  },
  file: {
    "signed-url:create": fileContracts.createSignedUrlForUploadContract,
  },
};

export {
  apikeyContracts,
  feedsContracts,
  healthContracts,
  organizationContracts,
  userContracts,
};
