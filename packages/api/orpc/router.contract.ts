import * as apikeyContracts from "./contracts/apikey.contract";
import * as feedsContracts from "./contracts/feeds.contract";
import * as healthContracts from "./contracts/health.contract";
import * as userContracts from "./contracts/user.contract";

export const routerContract = {
  health: {
    server: healthContracts.healthContract,
    client: healthContracts.protectedHealthContract,
  },
  apikey: {
    create: apikeyContracts.createAPIKeyContract,
    list: apikeyContracts.getAllApiKeysWithMetaContract,
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
};
