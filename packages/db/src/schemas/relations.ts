import { defineRelations } from "drizzle-orm";

import {
  agentKindConfigs,
  agentMemories,
  agentRuns,
  agentTaskConfigs,
  agentSessionEntries,
  agentSessions,
  agentToolApprovals,
  writingAgentDrafts,
  writingAgentSessions,
} from "./agent.schema.ts";
import { apikey } from "./apikey.schema.ts";
import { account, passkey, session } from "./auth.schema.ts";
import {
  assets,
  assetsToTags,
  feeds,
  feedsToTags,
  feedTranslations,
  tags,
  tagTranslations,
} from "./contents.schema.ts";
import {
  invitation,
  member,
  organization,
  project,
} from "./organization.schema.ts";
import { resourceChunks, resourceEmbeddings } from "./resources.schema.ts";
import { spotifyCredential } from "./spotify.schema.ts";
import { user } from "./user.schema.ts";

const schema = {
  user,
  session,
  account,
  passkey,
  apikey,
  resourceChunks,
  resourceEmbeddings,
  spotifyCredential,
  organization,
  member,
  invitation,
  project,
  tags,
  tagTranslations,
  assets,
  feeds,
  feedTranslations,
  assetsToTags,
  feedsToTags,
  agentSessions,
  agentRuns,
  agentSessionEntries,
  writingAgentSessions,
  writingAgentDrafts,
  agentToolApprovals,
  agentMemories,
  agentKindConfigs,
  agentTaskConfigs,
};

export const relations = defineRelations(schema, (r) => ({
  user: {
    sessions: r.many.session({ from: r.user.id, to: r.session.userId }),
    accounts: r.many.account({ from: r.user.id, to: r.account.userId }),
    passkeys: r.many.passkey({ from: r.user.id, to: r.passkey.userId }),
    spotifyCredential: r.one.spotifyCredential({
      from: r.user.id,
      to: r.spotifyCredential.userId,
    }),
    members: r.many.member({ from: r.user.id, to: r.member.userId }),
    invitations: r.many.invitation({
      from: r.user.id,
      to: r.invitation.inviterId,
    }),
    feeds: r.many.feeds({ from: r.user.id, to: r.feeds.userId }),
    assets: r.many.assets({ from: r.user.id, to: r.assets.userId }),
  },
  session: {
    user: r.one.user({ from: r.session.userId, to: r.user.id }),
  },
  account: {
    user: r.one.user({ from: r.account.userId, to: r.user.id }),
  },
  passkey: {
    user: r.one.user({ from: r.passkey.userId, to: r.user.id }),
  },
  apikey: {
    project: r.one.project({
      from: r.apikey.projectId,
      to: r.project.id,
    }),
  },
  spotifyCredential: {
    user: r.one.user({
      from: r.spotifyCredential.userId,
      to: r.user.id,
    }),
  },
  organization: {
    projects: r.many.project({
      from: r.organization.id,
      to: r.project.organizationId,
    }),
    members: r.many.member({
      from: r.organization.id,
      to: r.member.organizationId,
    }),
    invitations: r.many.invitation({
      from: r.organization.id,
      to: r.invitation.organizationId,
    }),
  },
  member: {
    organization: r.one.organization({
      from: r.member.organizationId,
      to: r.organization.id,
    }),
    user: r.one.user({ from: r.member.userId, to: r.user.id }),
  },
  invitation: {
    organization: r.one.organization({
      from: r.invitation.organizationId,
      to: r.organization.id,
    }),
    user: r.one.user({ from: r.invitation.inviterId, to: r.user.id }),
  },
  project: {
    organization: r.one.organization({
      from: r.project.organizationId,
      to: r.organization.id,
    }),
  },
  tags: {
    translations: r.many.tagTranslations({
      from: r.tags.id,
      to: r.tagTranslations.tagId,
    }),
    assetsToTags: r.many.assetsToTags({
      from: r.tags.id,
      to: r.assetsToTags.tagId,
    }),
    feedsToTags: r.many.feedsToTags({
      from: r.tags.id,
      to: r.feedsToTags.tagId,
    }),
  },
  tagTranslations: {
    tag: r.one.tags({
      from: r.tagTranslations.tagId,
      to: r.tags.id,
    }),
  },
  feeds: {
    translations: r.many.feedTranslations({
      from: r.feeds.id,
      to: r.feedTranslations.feedId,
    }),
    user: r.one.user({ from: r.feeds.userId, to: r.user.id }),
    feedsToTags: r.many.feedsToTags({
      from: r.feeds.id,
      to: r.feedsToTags.feedId,
    }),
  },
  feedTranslations: {
    feed: r.one.feeds({
      from: r.feedTranslations.feedId,
      to: r.feeds.id,
    }),
    chunks: r.many.resourceChunks({
      from: r.feedTranslations.id,
      to: r.resourceChunks.feedTranslationId,
    }),
  },
  resourceChunks: {
    feedTranslation: r.one.feedTranslations({
      from: r.resourceChunks.feedTranslationId,
      to: r.feedTranslations.id,
    }),
    embeddings: r.many.resourceEmbeddings({
      from: r.resourceChunks.id,
      to: r.resourceEmbeddings.chunkId,
    }),
  },
  resourceEmbeddings: {
    chunk: r.one.resourceChunks({
      from: r.resourceEmbeddings.chunkId,
      to: r.resourceChunks.id,
    }),
  },
  assets: {
    user: r.one.user({ from: r.assets.userId, to: r.user.id }),
    assetsToTags: r.many.assetsToTags({
      from: r.assets.id,
      to: r.assetsToTags.assetId,
    }),
  },
  assetsToTags: {
    asset: r.one.assets({
      from: r.assetsToTags.assetId,
      to: r.assets.id,
    }),
    tag: r.one.tags({ from: r.assetsToTags.tagId, to: r.tags.id }),
  },
  feedsToTags: {
    feed: r.one.feeds({ from: r.feedsToTags.feedId, to: r.feeds.id }),
    tag: r.one.tags({ from: r.feedsToTags.tagId, to: r.tags.id }),
  },
  agentSessions: {
    user: r.one.user({ from: r.agentSessions.userId, to: r.user.id }),
    runs: r.many.agentRuns({
      from: r.agentSessions.id,
      to: r.agentRuns.sessionId,
    }),
    entries: r.many.agentSessionEntries({
      from: r.agentSessions.id,
      to: r.agentSessionEntries.sessionId,
    }),
    writingState: r.one.writingAgentSessions({
      from: r.agentSessions.id,
      to: r.writingAgentSessions.sessionId,
    }),
    toolApprovals: r.many.agentToolApprovals({
      from: r.agentSessions.id,
      to: r.agentToolApprovals.sessionId,
    }),
    memories: r.many.agentMemories({
      from: r.agentSessions.id,
      to: r.agentMemories.sessionId,
    }),
  },
  agentRuns: {
    session: r.one.agentSessions({
      from: r.agentRuns.sessionId,
      to: r.agentSessions.id,
    }),
  },
  agentSessionEntries: {
    session: r.one.agentSessions({
      from: r.agentSessionEntries.sessionId,
      to: r.agentSessions.id,
    }),
  },
  writingAgentSessions: {
    session: r.one.agentSessions({
      from: r.writingAgentSessions.sessionId,
      to: r.agentSessions.id,
    }),
    targetFeed: r.one.feeds({
      from: r.writingAgentSessions.targetFeedId,
      to: r.feeds.id,
    }),
    drafts: r.many.writingAgentDrafts({
      from: r.writingAgentSessions.sessionId,
      to: r.writingAgentDrafts.sessionId,
    }),
  },
  writingAgentDrafts: {
    session: r.one.agentSessions({
      from: r.writingAgentDrafts.sessionId,
      to: r.agentSessions.id,
    }),
    writingState: r.one.writingAgentSessions({
      from: r.writingAgentDrafts.sessionId,
      to: r.writingAgentSessions.sessionId,
    }),
  },
  agentToolApprovals: {
    session: r.one.agentSessions({
      from: r.agentToolApprovals.sessionId,
      to: r.agentSessions.id,
    }),
    decidedByUser: r.one.user({
      from: r.agentToolApprovals.decidedBy,
      to: r.user.id,
    }),
  },
  agentMemories: {
    session: r.one.agentSessions({
      from: r.agentMemories.sessionId,
      to: r.agentSessions.id,
    }),
  },
}));

export const userRelations = relations.user;
export const sessionRelations = relations.session;
export const accountRelations = relations.account;
export const passkeyRelations = relations.passkey;
export const apikeyRelations = relations.apikey;
export const spotifyCredentialRelations = relations.spotifyCredential;
export const organizationRelations = relations.organization;
export const memberRelations = relations.member;
export const invitationRelations = relations.invitation;
export const projectRelations = relations.project;
export const tagsRelations = relations.tags;
export const tagTranslationsRelations = relations.tagTranslations;
export const feedsRelations = relations.feeds;
export const feedTranslationsRelations = relations.feedTranslations;
export const assetsRelations = relations.assets;
export const assetsToTagsRelations = relations.assetsToTags;
export const feedsToTagsRelations = relations.feedsToTags;
export const agentSessionsRelations = relations.agentSessions;
export const agentRunsRelations = relations.agentRuns;
export const agentSessionEntriesRelations = relations.agentSessionEntries;
export const writingAgentSessionsRelations = relations.writingAgentSessions;
export const writingAgentDraftsRelations = relations.writingAgentDrafts;
export const agentToolApprovalsRelations = relations.agentToolApprovals;
export const agentMemoriesRelations = relations.agentMemories;
