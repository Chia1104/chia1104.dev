import crypto from "node:crypto";

import GithubSlugger from "github-slugger";

import type { DB } from "@chia/db";
import {
  createFeed,
  updateFeed,
  upsertContent,
  upsertFeedTranslation,
} from "@chia/db/repos/feeds";
import { ContentType, Locale } from "@chia/db/types";
import type { FeedType, Locale as LocaleType } from "@chia/db/types";
import { AppError } from "@chia/service-kit/errors";

import { feedEvents } from "../orpc/events";

/**
 * Feed writes, shared by the oRPC procedures (a request, with `adminGuard`
 * supplying `adminId`) and the writing agent's durable turn (a workflow step,
 * no request at all). Each caller authorises in its own way before calling in;
 * authorisation belongs at the transport boundary.
 *
 * Errors are `AppError`, which every transport adapter already renders
 * (`toORPCError`).
 */

export interface FeedContentInput {
  content?: string | null;
  source?: string | null;
  unstableSerializedSource?: string | null;
}

/** `title` is required on create — `feed_translation.title` is `NOT NULL`. */
export interface CreateFeedTranslationInput {
  title: string;
  excerpt?: string | null;
  description?: string | null;
  summary?: string | null;
  readTime?: number | null;
  content?: FeedContentInput;
}

/** On update every field is optional, since a patch may touch only one of them. */
export type UpdateFeedTranslationInput = Partial<CreateFeedTranslationInput>;

/**
 * `FeedType` includes `"all"`, which is a filter value rather than a storable one, so the write
 * services accept only the two real kinds.
 */
export type StorableFeedType = Exclude<FeedType, "all">;

export interface CreateFeedServiceInput {
  /** Owner of the feed. The caller must already have verified this. */
  adminId: string;
  slug?: string;
  type: StorableFeedType;
  contentType?: ContentType;
  defaultLocale?: LocaleType;
  mainImage?: string | null;
  published?: boolean;
  createdAt?: number;
  updatedAt?: number;
  translations: Partial<Record<LocaleType, CreateFeedTranslationInput>>;
}

/**
 * A fresh slugger per call.
 *
 * `GithubSlugger` remembers what it has emitted and disambiguates repeats with a `-1` suffix, so
 * a shared instance would turn the same title into a different slug on every call.
 */
const slugify = (text: string): string => new GithubSlugger().slug(text);

export const createFeedService = async (
  db: DB,
  input: CreateFeedServiceInput
) => {
  const defaultLocale = input.defaultLocale ?? Locale.zhTW;
  const defaultTranslation = input.translations[defaultLocale];

  if (!defaultTranslation) {
    throw new AppError("BAD_REQUEST", {
      message: `No default translation provided for locale "${defaultLocale}"`,
    });
  }

  const data = await createFeed(db, {
    slug: input.slug
      ? slugify(input.slug)
      : // No slug given: derive one from the title plus a random suffix, because titles
        // collide and `feed.slug` is unique.
        slugify(
          `${defaultTranslation.title}-${crypto
            .getRandomValues(new Uint32Array(1))[0]
            ?.toString(16)}`
        ),
    type: input.type,
    userId: input.adminId,
    published: input.published ?? false,
    contentType: input.contentType ?? ContentType.Mdx,
    defaultLocale,
    mainImage: input.mainImage ?? null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    translations: Object.entries(input.translations).map(
      ([locale, translation]) => ({
        ...translation,
        locale: locale as LocaleType,
        content: translation.content?.content ?? null,
        source: translation.content?.source ?? null,
        unstableSerializedSource:
          translation.content?.unstableSerializedSource ?? null,
      })
    ),
  });

  // Fires reading-time, BM25 and embedding indexing. Skipping it is the main hazard of
  // reaching for the repository layer directly, which is why it lives in here.
  if (data) {
    await feedEvents.changed(data.id);
  }

  return data;
};

export interface UpdateFeedServiceInput {
  feedId: number;
  type?: StorableFeedType;
  contentType?: ContentType;
  defaultLocale?: LocaleType;
  mainImage?: string | null;
  published?: boolean;
  createdAt?: number;
  updatedAt?: number;
  translations?: Partial<Record<LocaleType, UpdateFeedTranslationInput>>;
}

export const updateFeedService = async (
  db: DB,
  input: UpdateFeedServiceInput
) => {
  const feedData = await updateFeed(db, {
    feedId: input.feedId,
    type: input.type,
    published: input.published,
    contentType: input.contentType,
    defaultLocale: input.defaultLocale,
    mainImage: input.mainImage,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  if (!feedData) {
    throw new AppError("NOT_FOUND", {
      message: `Feed ${input.feedId} not found`,
    });
  }

  const translationsData = [];
  const contentsData = [];

  if (input.translations) {
    for (const [locale, translation] of Object.entries(input.translations)) {
      const translationData = await upsertFeedTranslation(db, {
        feedId: input.feedId,
        locale: locale as LocaleType,
        title: translation.title,
        excerpt: translation.excerpt ?? null,
        description: translation.description ?? null,
        summary: translation.summary ?? null,
        readTime: translation.readTime ?? null,
      });

      if (!translationData) continue;
      translationsData.push(translationData);

      const content = translation.content;
      if (content && translationData.id) {
        const contentData = await upsertContent(db, {
          feedTranslationId: translationData.id,
          content: content.content ?? null,
          source: content.source ?? null,
          unstableSerializedSource: content.unstableSerializedSource ?? null,
        });
        if (contentData) contentsData.push(contentData);
      }
    }
  }

  const updatedFeed = {
    ...feedData,
    translations: translationsData,
    contents: contentsData,
  };

  await feedEvents.changed(updatedFeed.id);

  return updatedFeed;
};
