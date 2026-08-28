import * as agentAdminContracts from "./contracts/agent-admin.contract";
import * as agentContracts from "./contracts/agent.contract";
import * as apikeyContracts from "./contracts/apikey.contract";
import * as emailContracts from "./contracts/email.contract";
import * as feedsContracts from "./contracts/feeds.contract";
import * as fileContracts from "./contracts/file.contract";
import * as healthContracts from "./contracts/health.contract";
import * as memoryContracts from "./contracts/memory.contract";
import * as organizationContracts from "./contracts/organization.contract";
import * as ragContracts from "./contracts/rag.contract";
import * as spotifyContracts from "./contracts/spotify.contract";
import * as toolingsContracts from "./contracts/toolings.contract";
import * as userContracts from "./contracts/user.contract";

export const routerContract = {
  agent: {
    sessions: {
      list: agentContracts.listAgentSessionsContract,
      create: agentContracts.createAgentSessionContract,
      get: agentContracts.getAgentSessionContract,
      delete: agentContracts.deleteAgentSessionContract,
      "settings:update": agentContracts.updateAgentSessionSettingsContract,
      chat: agentContracts.chatAgentContract,
      abort: agentContracts.abortAgentContract,
      approve: agentContracts.approveAgentToolContract,
      compact: agentContracts.compactAgentSessionContract,
      navigate: agentContracts.navigateAgentSessionContract,
      fork: agentContracts.forkAgentSessionContract,
    },
    models: {
      list: agentContracts.listAgentModelsContract,
    },
    capabilities: {
      list: agentContracts.listAgentCapabilitiesContract,
    },
    admin: {
      kinds: {
        list: agentAdminContracts.listAgentKindsAdminContract,
        update: agentAdminContracts.updateAgentKindAdminContract,
      },
      tasks: {
        list: agentAdminContracts.listAgentTasksAdminContract,
        update: agentAdminContracts.updateAgentTaskAdminContract,
        models: agentAdminContracts.listAgentTaskModelsAdminContract,
      },
      quota: {
        get: agentAdminContracts.getAgentQuotaAdminContract,
        update: agentAdminContracts.updateAgentQuotaAdminContract,
      },
    },
  },
  health: {
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
    list: userContracts.getInfiniteUsersContract,
  },
  feeds: {
    list: feedsContracts.getFeedsContract,
    "details-by-slug": feedsContracts.getFeedBySlugContract,
    "details-by-id": feedsContracts.getFeedByIdContract,
    related: feedsContracts.getRelatedFeedsContract,
    search: feedsContracts.searchFeedsContract,
    "search:advanced": feedsContracts.searchFeedsAdvancedContract,
    create: feedsContracts.createFeedContract,
    update: feedsContracts.updateFeedContract,
    delete: feedsContracts.deleteFeedContract,
    restore: feedsContracts.restoreFeedContract,
    "translation:upsert": feedsContracts.upsertFeedTranslationContract,
    "content:upsert": feedsContracts.upsertContentContract,
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
    list: fileContracts.listObjectsContract,
    delete: fileContracts.deleteObjectContract,
  },
  toolings: {
    "link-preview": toolingsContracts.linkPreviewContract,
  },
  email: {
    send: emailContracts.sendContactEmailContract,
  },
  rag: {
    overview: ragContracts.getRagOverviewContract,
    "chunks:list": ragContracts.listRagChunksContract,
    "chunk:get": ragContracts.getRagChunkContract,
    "resource:status": ragContracts.getResourceIndexStatusContract,
    "runs:list": ragContracts.listIndexRunsContract,
    "run:get": ragContracts.getIndexRunContract,
    "reindex:all:preview": ragContracts.previewReindexAllContract,
    "resource:index": ragContracts.indexResourceContract,
    "feed:index": ragContracts.indexFeedContract,
    "reindex:all": ragContracts.reindexAllContract,
    "embeddings:prune": ragContracts.pruneEmbeddingsContract,
  },
  memory: {
    list: memoryContracts.listMemoriesContract,
    get: memoryContracts.getMemoryContract,
    update: memoryContracts.updateMemoryContract,
    remove: memoryContracts.removeMemoryContract,
    "lesson:approve": memoryContracts.approveLessonContract,
    consolidate: memoryContracts.consolidateMemoryContract,
  },
  spotify: {
    playlist: spotifyContracts.getSpotifyPlaylistContract,
    playing: spotifyContracts.getSpotifyNowPlayingContract,
    accounts: spotifyContracts.getSpotifyAccountsContract,
    authorize: spotifyContracts.createSpotifyAuthorizationContract,
    activate: spotifyContracts.activateSpotifyAccountContract,
    disconnect: spotifyContracts.disconnectSpotifyAccountContract,
  },
};

export {
  agentAdminContracts,
  agentContracts,
  apikeyContracts,
  emailContracts,
  feedsContracts,
  healthContracts,
  memoryContracts,
  organizationContracts,
  ragContracts,
  spotifyContracts,
  toolingsContracts,
  userContracts,
};
