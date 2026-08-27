// Table creator
export { pgTable } from "./table.ts";

// Common utilities
export {
  timestamps,
  optionalTimestamps,
  softDelete,
} from "../libs/common.schema.ts";

// Enums
export {
  roles,
  feedType,
  contentType,
  locale,
  invitationStatus,
  memberRole,
  type Role,
  type FeedType,
  type ContentType,
  type Locale,
  type InvitationStatus,
  type MemberRole,
} from "./enums.ts";

// Users
export { user, type User } from "./user.schema.ts";

// Auth
export {
  session,
  account,
  verification,
  passkey,
  type Session,
  type Account,
  type Verification,
  type Passkey,
} from "./auth.schema.ts";

// Organization
export {
  organization,
  member,
  invitation,
  project,
  type Organization,
  type Member,
  type Invitation,
  type Project,
} from "./organization.schema.ts";

// API Key
export { apikey, type ApiKey } from "./apikey.schema.ts";

// Spotify
export { spotifyCredential, type SpotifyCredential } from "./spotify.schema.ts";

// Contents
export {
  tags,
  tagTranslations,
  assets,
  feeds,
  feedTranslations,
  assetsToTags,
  feedsToTags,
  type Asset,
  type Feed,
  type FeedTranslation,
  type Tag,
  type TagTranslation,
} from "./contents.schema.ts";

// Resources (chunks + vectors)
export {
  resourceChunks,
  resourceEmbeddings,
  resourceIndexRuns,
  RESOURCE_CHUNK_KIND,
  RESOURCE_INDEX_RUN_ACTIVE_STATUSES,
  RESOURCE_INDEX_RUN_SCOPE,
  RESOURCE_INDEX_RUN_STATUS,
  type ResourceChunk,
  type ResourceChunkKind,
  type ResourceEmbedding,
  type ResourceIndexRun,
  type ResourceIndexRunProgress,
  type ResourceIndexRunScope,
  type ResourceIndexRunStatus,
} from "./resources.schema.ts";

// Agent
export {
  agentSessions,
  agentRuns,
  agentSessionEntries,
  writingAgentSessions,
  writingAgentDrafts,
  agentToolApprovals,
  agentMemories,
  agentKindConfigs,
  agentTaskConfigs,
  AGENT_MEMORY_KIND,
  AGENT_MEMORY_STATUS,
  type AgentMemory,
  type AgentMemoryKind,
  type AgentMemoryStatus,
  type AgentSession,
  type AgentRun,
  type AgentRunStatus,
  type AgentSessionEntry,
  type WritingAgentSession,
  type WritingAgentDraft,
  type AgentToolApproval,
  type AgentApprovalStatus,
  type AgentKindConfig,
  type AgentTaskConfig,
  type AgentTaskParams,
} from "./agent.schema.ts";

// Relations
export {
  relations,
  userRelations,
  sessionRelations,
  accountRelations,
  passkeyRelations,
  apikeyRelations,
  spotifyCredentialRelations,
  organizationRelations,
  memberRelations,
  invitationRelations,
  projectRelations,
  tagsRelations,
  tagTranslationsRelations,
  feedsRelations,
  feedTranslationsRelations,
  assetsRelations,
  assetsToTagsRelations,
  feedsToTagsRelations,
  agentSessionsRelations,
  agentRunsRelations,
  agentSessionEntriesRelations,
  writingAgentSessionsRelations,
  writingAgentDraftsRelations,
  agentToolApprovalsRelations,
  agentMemoriesRelations,
} from "./relations.ts";
