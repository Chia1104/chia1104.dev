import { defineRelations } from "drizzle-orm";

import { apikey } from "./apikey.schema.ts";
import { account, passkey, session } from "./auth.schema.ts";
import {
  assets,
  assetsToTags,
  contents,
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
import { user } from "./user.schema.ts";

const schema = {
  user,
  session,
  account,
  passkey,
  apikey,
  organization,
  member,
  invitation,
  project,
  tags,
  tagTranslations,
  assets,
  feeds,
  feedTranslations,
  contents,
  assetsToTags,
  feedsToTags,
};

export const relations = defineRelations(schema, (r) => ({
  user: {
    sessions: r.many.session({ from: r.user.id, to: r.session.userId }),
    accounts: r.many.account({ from: r.user.id, to: r.account.userId }),
    passkeys: r.many.passkey({ from: r.user.id, to: r.passkey.userId }),
    apikeys: r.many.apikey({ from: r.user.id, to: r.apikey.userId }),
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
    user: r.one.user({ from: r.apikey.userId, to: r.user.id }),
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
    content: r.one.contents({
      from: r.feedTranslations.id,
      to: r.contents.feedTranslationId,
    }),
  },
  assets: {
    user: r.one.user({ from: r.assets.userId, to: r.user.id }),
    assetsToTags: r.many.assetsToTags({
      from: r.assets.id,
      to: r.assetsToTags.assetId,
    }),
  },
  contents: {
    feedTranslation: r.one.feedTranslations({
      from: r.contents.feedTranslationId,
      to: r.feedTranslations.id,
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
}));

export const userRelations = relations.user;
export const sessionRelations = relations.session;
export const accountRelations = relations.account;
export const passkeyRelations = relations.passkey;
export const apikeyRelations = relations.apikey;
export const organizationRelations = relations.organization;
export const memberRelations = relations.member;
export const invitationRelations = relations.invitation;
export const projectRelations = relations.project;
export const tagsRelations = relations.tags;
export const tagTranslationsRelations = relations.tagTranslations;
export const feedsRelations = relations.feeds;
export const feedTranslationsRelations = relations.feedTranslations;
export const assetsRelations = relations.assets;
export const contentsRelations = relations.contents;
export const assetsToTagsRelations = relations.assetsToTags;
export const feedsToTagsRelations = relations.feedsToTags;
