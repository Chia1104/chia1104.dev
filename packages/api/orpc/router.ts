import * as agentRoutes from "./routes/agent.route";
import * as apikeyRoutes from "./routes/apikey.route";
import * as emailRoutes from "./routes/email.route";
import * as feedsRoutes from "./routes/feeds.route";
import * as fileRoutes from "./routes/file.route";
import * as healthRoutes from "./routes/health.route";
import * as organizationRoutes from "./routes/organization.route";
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
  },
  health: {
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
    list: fileRoutes.listObjectsRoute,
    delete: fileRoutes.deleteObjectRoute,
  },
  user: {
    "profile:update": userRoutes.updateUserProfileRoute,
    list: userRoutes.getInfiniteUsersRoute,
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
  spotify: {
    playlist: spotifyRoutes.getSpotifyPlaylistRoute,
    playing: spotifyRoutes.getSpotifyNowPlayingRoute,
    accounts: spotifyRoutes.getSpotifyAccountsRoute,
    authorize: spotifyRoutes.createSpotifyAuthorizationRoute,
    activate: spotifyRoutes.activateSpotifyAccountRoute,
    disconnect: spotifyRoutes.disconnectSpotifyAccountRoute,
  },
});
