import type { DB } from "@chia/db/client";
import {
  createFeed,
  updateFeed,
  upsertContent,
  upsertFeedTranslation,
} from "@chia/db/repos/feeds";
import { Locale } from "@chia/db/types";
import type { FeedType, Locale as LocaleType } from "@chia/db/types";
import { AppError } from "@chia/service-kit/errors";
import { normalizeAsciiSlug } from "@chia/utils/slug";

import type { FeedHooks } from "../orpc/utils";

/**
 * Shared by oRPC (a request, with `adminGuard` supplying `adminId`) and the writing
 * agent's durable turn (a workflow step, no request). Authorisation belongs at the
 * transport boundary. `hooks` is required: a write that skips `onFeedChanged` leaves
 * the feed unindexed. A caller with no indexer passes `{}`.
 */

/** `title` is required on create — `feed_translation.title` is `NOT NULL`. */
export interface CreateFeedTranslationInput {
  title: string;
  excerpt?: string | null;
  description?: string | null;
  summary?: string | null;
  readTime?: number | null;
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
  defaultLocale?: LocaleType;
  mainImage?: string | null;
  published?: boolean;
  createdAt?: number;
  updatedAt?: number;
  translations: Partial<Record<LocaleType, CreateFeedTranslationInput>>;
}

export const createFeedService = async (
  db: DB,
  input: CreateFeedServiceInput,
  hooks: FeedHooks
) => {
  const defaultLocale = input.defaultLocale ?? Locale.zhTW;
  const defaultTranslation = input.translations[defaultLocale];

  if (!defaultTranslation) {
    throw new AppError("BAD_REQUEST", {
      message: `No default translation provided for locale "${defaultLocale}"`,
    });
  }

  const slug = normalizeAsciiSlug(input.slug);
  if (!slug) {
    throw new AppError("BAD_REQUEST", {
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
    translations: Object.entries(input.translations).map(
      ([locale, translation]) => ({
        ...translation,
        locale:
          /* SAFETY: The producer contract guarantees this value satisfies LocaleType. */ locale as LocaleType,
        content: translation.content ?? null,
      })
    ),
  });

  // reading-time, BM25 and embedding indexing
  if (data) {
    await hooks.onFeedChanged?.(data.id);
  }

  return data;
};

export interface UpdateFeedServiceInput {
  feedId: number;
  type?: StorableFeedType;
  defaultLocale?: LocaleType;
  mainImage?: string | null;
  published?: boolean;
  createdAt?: number;
  updatedAt?: number;
  translations?: Partial<Record<LocaleType, UpdateFeedTranslationInput>>;
}

export const updateFeedService = async (
  db: DB,
  input: UpdateFeedServiceInput,
  hooks: FeedHooks
) => {
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
        locale:
          /* SAFETY: The producer contract guarantees this value satisfies LocaleType. */ locale as LocaleType,
        title: translation.title,
        excerpt: translation.excerpt ?? null,
        description: translation.description ?? null,
        summary: translation.summary ?? null,
        readTime: translation.readTime ?? null,
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

  await hooks.onFeedChanged?.(updatedFeed.id);

  return updatedFeed;
};
