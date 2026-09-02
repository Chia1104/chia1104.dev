import * as agentAdminRoutes from "./routes/agent-admin.route";
import * as agentRoutes from "./routes/agent.route";
import * as apikeyRoutes from "./routes/apikey.route";
import * as dashboardRoutes from "./routes/dashboard.route";
import * as emailRoutes from "./routes/email.route";
import * as feedsRoutes from "./routes/feeds.route";
import * as fileRoutes from "./routes/file.route";
import * as healthRoutes from "./routes/health.route";
import * as memoryRoutes from "./routes/memory.route";
import * as ragRoutes from "./routes/rag.route";
import * as spotifyRoutes from "./routes/spotify.route";
import * as toolingsRoutes from "./routes/toolings.route";
import * as userRoutes from "./routes/user.route";
import { contractOS } from "./utils";

export const router = contractOS.router({
  agent: {
    sessions: {
      list: agentRoutes.listAgentSessionsRoute,
      create: agentRoutes.createAgentSessionRoute,
      get: agentRoutes.getAgentSessionRoute,
      delete: agentRoutes.deleteAgentSessionRoute,
      "settings:update": agentRoutes.updateAgentSessionSettingsRoute,
      chat: agentRoutes.chatAgentRoute,
      abort: agentRoutes.abortAgentRoute,
      approve: agentRoutes.approveAgentToolRoute,
      compact: agentRoutes.compactAgentSessionRoute,
      navigate: agentRoutes.navigateAgentSessionRoute,
      fork: agentRoutes.forkAgentSessionRoute,
    },
    models: {
      list: agentRoutes.listAgentModelsRoute,
    },
    capabilities: {
      list: agentRoutes.listAgentCapabilitiesRoute,
    },
    usage: {
      me: agentRoutes.getAgentUsageRoute,
    },
    admin: {
      kinds: {
        list: agentAdminRoutes.listAgentKindsAdminRoute,
        update: agentAdminRoutes.updateAgentKindAdminRoute,
      },
      tasks: {
        list: agentAdminRoutes.listAgentTasksAdminRoute,
        update: agentAdminRoutes.updateAgentTaskAdminRoute,
        models: agentAdminRoutes.listAgentTaskModelsAdminRoute,
      },
      quota: {
        get: agentAdminRoutes.getAgentQuotaAdminRoute,
        update: agentAdminRoutes.updateAgentQuotaAdminRoute,
      },
      usage: {
        week: agentAdminRoutes.getAgentUsageWeekAdminRoute,
        user: agentAdminRoutes.getAgentUserUsageAdminRoute,
      },
    },
  },
  dashboard: {
    overview: dashboardRoutes.getDashboardOverviewRoute,
  },
  health: {
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
    list: feedsRoutes.getFeedsRoute,
    "details-by-slug": feedsRoutes.getFeedBySlugRoute,
    "details-by-id": feedsRoutes.getFeedByIdRoute,
    related: feedsRoutes.getRelatedFeedsRoute,
    search: feedsRoutes.searchFeedsRoute,
    "search:advanced": feedsRoutes.searchFeedsAdvancedRoute,
    create: feedsRoutes.createFeedRoute,
    update: feedsRoutes.updateFeedRoute,
    delete: feedsRoutes.deleteFeedRoute,
    restore: feedsRoutes.restoreFeedRoute,
    "translation:upsert": feedsRoutes.upsertFeedTranslationRoute,
    "content:upsert": feedsRoutes.upsertContentRoute,
  },
  file: {
    "signed-url:create": fileRoutes.createSignedUrlForUploadRoute,
    list: fileRoutes.listObjectsRoute,
    delete: fileRoutes.deleteObjectRoute,
  },
  user: {
    list: userRoutes.listUsersRoute,
    get: userRoutes.getUserRoute,
  },
  toolings: {
    "link-preview": toolingsRoutes.linkPreviewRoute,
  },
  email: {
    send: emailRoutes.sendContactEmailRoute,
  },
  rag: {
    overview: ragRoutes.getRagOverviewRoute,
    "chunks:list": ragRoutes.listRagChunksRoute,
    "chunk:get": ragRoutes.getRagChunkRoute,
    "resource:status": ragRoutes.getResourceIndexStatusRoute,
    "runs:list": ragRoutes.listIndexRunsRoute,
    "run:get": ragRoutes.getIndexRunRoute,
    "reindex:all:preview": ragRoutes.previewReindexAllRoute,
    "resource:index": ragRoutes.indexResourceRoute,
    "feed:index": ragRoutes.indexFeedRoute,
    "reindex:all": ragRoutes.reindexAllRoute,
    "embeddings:prune": ragRoutes.pruneEmbeddingsRoute,
  },
  memory: {
    list: memoryRoutes.listMemoriesRoute,
    get: memoryRoutes.getMemoryRoute,
    update: memoryRoutes.updateMemoryRoute,
    remove: memoryRoutes.removeMemoryRoute,
    "lesson:approve": memoryRoutes.approveLessonRoute,
    consolidate: memoryRoutes.consolidateMemoryRoute,
  },
  spotify: {
    playlist: spotifyRoutes.getSpotifyPlaylistRoute,
    playing: spotifyRoutes.getSpotifyNowPlayingRoute,
    accounts: spotifyRoutes.getSpotifyAccountsRoute,
    authorize: spotifyRoutes.createSpotifyAuthorizationRoute,
    activate: spotifyRoutes.activateSpotifyAccountRoute,
    disconnect: spotifyRoutes.disconnectSpotifyAccountRoute,
  },
});
