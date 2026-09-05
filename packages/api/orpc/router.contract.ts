import * as agentAdminContracts from "./contracts/agent-admin.contract";
import * as agentContracts from "./contracts/agent.contract";
import * as apikeyContracts from "./contracts/apikey.contract";
import * as dashboardContracts from "./contracts/dashboard.contract";
import * as emailContracts from "./contracts/email.contract";
import * as feedsContracts from "./contracts/feeds.contract";
import * as fileContracts from "./contracts/file.contract";
import * as healthContracts from "./contracts/health.contract";
import * as memoryContracts from "./contracts/memory.contract";
import * as profileContracts from "./contracts/profile.contract";
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
    usage: {
      me: agentContracts.getAgentUsageContract,
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
      usage: {
        week: agentAdminContracts.getAgentUsageWeekAdminContract,
        user: agentAdminContracts.getAgentUserUsageAdminContract,
      },
    },
  },
  dashboard: {
    access: dashboardContracts.getDashboardAccessContract,
    overview: dashboardContracts.getDashboardOverviewContract,
  },
  health: {
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
    list: userContracts.listUsersContract,
    get: userContracts.getUserContract,
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
    "draft:open": feedsContracts.openFeedDraftContract,
    "draft:get": feedsContracts.getFeedDraftContract,
    "draft:list": feedsContracts.listFeedDraftsContract,
    "draft:patch": feedsContracts.patchFeedDraftContract,
    "draft:apply": feedsContracts.applyFeedDraftContract,
    "draft:discard": feedsContracts.discardFeedDraftContract,
    "draft:revisions": feedsContracts.listFeedDraftRevisionsContract,
    "draft:restore": feedsContracts.restoreFeedDraftRevisionContract,
    "draft:watch": feedsContracts.watchFeedDraftContract,
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
  profile: {
    list: profileContracts.listProfileEntriesContract,
    get: profileContracts.getProfileEntryContract,
    create: profileContracts.createProfileEntryContract,
    update: profileContracts.updateProfileEntryContract,
    remove: profileContracts.removeProfileEntryContract,
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
  dashboardContracts,
  emailContracts,
  feedsContracts,
  healthContracts,
  memoryContracts,
  profileContracts,
  ragContracts,
  spotifyContracts,
  toolingsContracts,
  userContracts,
};
