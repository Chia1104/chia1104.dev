import * as agentRoutes from "./routes/agent.route";
import * as apikeyRoutes from "./routes/apikey.route";
import * as contentRoutes from "./routes/content.route";
import * as emailRoutes from "./routes/email.route";
import * as feedsRoutes from "./routes/feeds.route";
import * as fileRoutes from "./routes/file.route";
import * as healthRoutes from "./routes/health.route";
import * as mediaRoutes from "./routes/media.route";
import * as organizationRoutes from "./routes/organization.route";
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
      prompt: agentRoutes.promptAgentRoute,
      stream: agentRoutes.streamAgentRoute,
      abort: agentRoutes.abortAgentRoute,
      steer: agentRoutes.steerAgentRoute,
      approve: agentRoutes.approveAgentToolRoute,
      compact: agentRoutes.compactAgentSessionRoute,
      navigate: agentRoutes.navigateAgentSessionRoute,
      draft: agentRoutes.getAgentDraftRoute,
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
    list: feedsRoutes.getFeedsWithMetaRoute,
    "details-by-slug": feedsRoutes.getFeedBySlugRoute,
    "details-by-id": feedsRoutes.getFeedByIdRoute,
    create: feedsRoutes.createFeedRoute,
    update: feedsRoutes.updateFeedRoute,
    delete: feedsRoutes.deleteFeedRoute,
    restore: feedsRoutes.restoreFeedRoute,
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
  content: {
    feeds: {
      list: contentRoutes.getPublicFeedsRoute,
      total: contentRoutes.getPublicFeedsTotalRoute,
      "details-by-slug": contentRoutes.getPublicFeedBySlugRoute,
      "details-by-id": contentRoutes.getPublicFeedByIdRoute,
      related: contentRoutes.getPublicRelatedFeedsRoute,
      "translation:upsert": contentRoutes.upsertPublicFeedTranslationRoute,
      "content:upsert": contentRoutes.upsertPublicFeedContentRoute,
      update: contentRoutes.updatePublicFeedRoute,
      "public-list": contentRoutes.listPublicFeedsRoute,
      "public-search": contentRoutes.searchPublicFeedsRoute,
      search: contentRoutes.searchFeedsRoute,
    },
  },
  media: {
    spotify: {
      playlist: mediaRoutes.getSpotifyPlaylistRoute,
      playing: mediaRoutes.getSpotifyNowPlayingRoute,
    },
  },
  spotify: {
    manage: {
      accounts: spotifyRoutes.getSpotifyAccountsRoute,
      authorize: spotifyRoutes.createSpotifyAuthorizationRoute,
      activate: spotifyRoutes.activateSpotifyAccountRoute,
      disconnect: spotifyRoutes.disconnectSpotifyAccountRoute,
    },
  },
});
