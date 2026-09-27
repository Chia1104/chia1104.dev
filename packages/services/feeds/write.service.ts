import type { DB } from "@chia/db/client";
import {
  createFeed,
  getFeedForIndexing,
  updateFeed,
  upsertContent,
  upsertFeedTranslation,
} from "@chia/db/repos/feeds";
import { findTagIds, setFeedTags } from "@chia/db/repos/tags";
import { Locale } from "@chia/db/types";
import type { FeedType } from "@chia/db/types";
import { AppError, AppErrorCode } from "@chia/service-kit/errors";
import { normalizeAsciiSlug } from "@chia/utils/slug";
import { FeedChangeScope } from "@chia/workflow-control/contract";

import type { FeedHooks } from "../shared/context";

/**
 * Shared by oRPC (a request, with `adminGuard` supplying `adminId`) and the writing
 * agent's durable turn (a workflow step, no request). Authorisation belongs at the
 * transport boundary. `hooks` is required: a write that skips `onFeedChanged` leaves
 * the feed unindexed. A caller with no indexer passes `{}`.
 */

/**
 * `title` is required on create — `feed_translation.title` is `NOT NULL`. `summary` and
 * `read_time` are absent: workflows own them, and an apply must leave them alone.
 */
export interface CreateFeedTranslationInput {
  title: string;
  excerpt?: string | null;
  description?: string | null;
  /** MDX body. `undefined` leaves the stored body alone on update. */
  content?: string | null;
}

export type UpdateFeedTranslationInput = Partial<CreateFeedTranslationInput>;

/**
 * `FeedType` includes `"all"`, which is a filter value rather than a storable one, so the write
 * services accept only the two real kinds.
 */
export type StorableFeedType = Exclude<FeedType, "all">;

export interface CreateFeedServiceInput {
  /** Owner of the feed. The caller must already have verified this. */
  adminId: string;
  slug: string;
  type: StorableFeedType;
  defaultLocale?: Locale;
  mainImage?: string | null;
  published?: boolean;
  createdAt?: number;
  updatedAt?: number;
  translations: Partial<Record<Locale, CreateFeedTranslationInput>>;
}

export const createFeedService = async (
  db: DB,
  input: CreateFeedServiceInput,
  hooks: FeedHooks
) => {
  const defaultLocale = input.defaultLocale ?? Locale.ZhTW;
  const defaultTranslation = input.translations[defaultLocale];

  if (!defaultTranslation) {
    throw new AppError(AppErrorCode.BadRequest, {
      message: `No default translation provided for locale "${defaultLocale}"`,
    });
  }

  const slug = normalizeAsciiSlug(input.slug);
  if (!slug) {
    throw new AppError(AppErrorCode.BadRequest, {
      message:
        "Feed slug must be an English/ASCII phrase. Slug normalization does not translate or transliterate titles.",
    });
  }

  const data = await createFeed(db, {
    slug,
    type: input.type,
    userId: input.adminId,
    published: input.published ?? false,
    defaultLocale,
    mainImage: input.mainImage ?? null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    translations: Object.values(Locale).flatMap((locale) => {
      const translation = input.translations[locale];
      return translation
        ? [{ ...translation, locale, content: translation.content ?? null }]
        : [];
    }),
  });

  // reading-time, BM25 and embedding indexing
  if (data) {
    await hooks.onFeedChanged?.(data.id, FeedChangeScope.Listing);
  }

  return data;
};

export interface UpdateFeedServiceInput {
  feedId: number;
  type?: StorableFeedType;
  defaultLocale?: Locale;
  mainImage?: string | null;
  published?: boolean;
  /** The whole tag set; an empty array clears it. */
  tagIds?: number[];
  createdAt?: number;
  updatedAt?: number;
  translations?: Partial<Record<Locale, UpdateFeedTranslationInput>>;
}

/**
 * What list and tag pages show of a feed, as one comparable value. An apply sends every
 * title whether or not it changed, so the write's input cannot tell.
 */
const readListing = async (db: DB, feedId: number) => {
  const feed = await getFeedForIndexing(db, { feedId });
  if (!feed) return null;
  return JSON.stringify({
    type: feed.type,
    published: feed.published,
    createdAt: feed.createdAt,
    deletedAt: feed.deletedAt,
    defaultLocale: feed.defaultLocale,
    tags: feed.tags.map((tag) => `${tag.locale}:${tag.name}`).toSorted(),
    translations: feed.translations
      .map((translation) =>
        [translation.locale, translation.title, translation.description].join(
          "\u0000"
        )
      )
      .toSorted(),
  });
};

export const updateFeedService = async (
  db: DB,
  input: UpdateFeedServiceInput,
  hooks: FeedHooks
) => {
  const listingBefore = hooks.onFeedChanged
    ? await readListing(db, input.feedId)
    : null;
  const feedData = await updateFeed(db, {
    feedId: input.feedId,
    type: input.type,
    published: input.published,
    defaultLocale: input.defaultLocale,
    mainImage: input.mainImage,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  if (!feedData) {
    throw new AppError(AppErrorCode.NotFound, {
      message: `Feed ${input.feedId} not found`,
    });
  }

  if (input.tagIds) {
    const known = new Set(await findTagIds(db, input.tagIds));
    const unknown = input.tagIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new AppError(AppErrorCode.BadRequest, {
        message: `No tag has id ${unknown.join(", ")}`,
      });
    }
    await setFeedTags(db, { feedId: input.feedId, tagIds: input.tagIds });
  }

  const translationsData = [];
  const contentsData = [];

  if (input.translations) {
    for (const locale of Object.values(Locale)) {
      const translation = input.translations[locale];
      if (!translation) continue;
      const translationData = await upsertFeedTranslation(db, {
        feedId: input.feedId,
        locale,
        title: translation.title,
        excerpt: translation.excerpt ?? null,
        description: translation.description ?? null,
      });

      if (!translationData) continue;
      translationsData.push(translationData);

      if (translation.content !== undefined && translationData.id) {
        const contentData = await upsertContent(db, {
          feedTranslationId: translationData.id,
          content: translation.content,
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

  if (hooks.onFeedChanged) {
    const listingAfter = await readListing(db, updatedFeed.id);
    await hooks.onFeedChanged(
      updatedFeed.id,
      listingBefore === listingAfter
        ? FeedChangeScope.Article
        : FeedChangeScope.Listing
    );
  }

  return updatedFeed;
};
