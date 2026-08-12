import * as agentContracts from "./contracts/agent.contract";
import * as apikeyContracts from "./contracts/apikey.contract";
import * as contentContracts from "./contracts/content.contract";
import * as emailContracts from "./contracts/email.contract";
import * as feedsContracts from "./contracts/feeds.contract";
import * as fileContracts from "./contracts/file.contract";
import * as healthContracts from "./contracts/health.contract";
import * as mediaContracts from "./contracts/media.contract";
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
      prompt: agentContracts.promptAgentContract,
      stream: agentContracts.streamAgentContract,
      chat: agentContracts.chatAgentContract,
      abort: agentContracts.abortAgentContract,
      steer: agentContracts.steerAgentContract,
      approve: agentContracts.approveAgentToolContract,
      compact: agentContracts.compactAgentSessionContract,
      navigate: agentContracts.navigateAgentSessionContract,
      draft: agentContracts.getAgentDraftContract,
    },
    models: {
      list: agentContracts.listAgentModelsContract,
    },
    capabilities: {
      list: agentContracts.listAgentCapabilitiesContract,
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
    list: feedsContracts.getFeedsWithMetaContract,
    "details-by-slug": feedsContracts.getFeedBySlugContract,
    "details-by-id": feedsContracts.getFeedByIdContract,
    create: feedsContracts.createFeedContract,
    update: feedsContracts.updateFeedContract,
    delete: feedsContracts.deleteFeedContract,
    restore: feedsContracts.restoreFeedContract,
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
  content: {
    feeds: {
      list: contentContracts.getPublicFeedsContract,
      total: contentContracts.getPublicFeedsTotalContract,
      "details-by-slug": contentContracts.getPublicFeedBySlugContract,
      "details-by-id": contentContracts.getPublicFeedByIdContract,
      related: contentContracts.getPublicRelatedFeedsContract,
      "translation:upsert":
        contentContracts.upsertPublicFeedTranslationContract,
      "content:upsert": contentContracts.upsertPublicFeedContentContract,
      update: contentContracts.updatePublicFeedContract,
      "public-list": contentContracts.listPublicFeedsContract,
      "public-search": contentContracts.searchPublicFeedsContract,
      search: contentContracts.searchFeedsContract,
    },
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
  media: {
    spotify: {
      playlist: mediaContracts.getSpotifyPlaylistContract,
      playing: mediaContracts.getSpotifyNowPlayingContract,
    },
  },
  spotify: {
    manage: {
      accounts: spotifyContracts.getSpotifyAccountsContract,
      authorize: spotifyContracts.createSpotifyAuthorizationContract,
      activate: spotifyContracts.activateSpotifyAccountContract,
      disconnect: spotifyContracts.disconnectSpotifyAccountContract,
    },
  },
};

export {
  agentContracts,
  apikeyContracts,
  contentContracts,
  emailContracts,
  feedsContracts,
  healthContracts,
  mediaContracts,
  organizationContracts,
  ragContracts,
  spotifyContracts,
  toolingsContracts,
  userContracts,
};
