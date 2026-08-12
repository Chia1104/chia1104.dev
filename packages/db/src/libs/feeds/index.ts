import type { KnownKeysOnly, RelationsFilterColumns } from "drizzle-orm";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import dayjs from "@chia/utils/day";

import type { DB } from "../../index.ts";
import type { Locale, relations } from "../../schemas/index.ts";
import {
  feeds,
  feedsToTags,
  feedTranslations,
  tags,
  tagTranslations,
} from "../../schemas/index.ts";
import { FeedOrderBy, FeedType, Locale as LocaleEnum } from "../../types.ts";
import { parseCursorForOrder, withDTO } from "../index.ts";
import type {
  InfiniteDTO,
  InsertFeedDTO,
  InsertFeedTranslationDTO,
  UpdateFeedDTO,
  UpdateFeedTranslationDTO,
} from "../validator/feeds.ts";

const FEED_DATE_ORDER_BY: ReadonlySet<FeedOrderBy> = new Set([
  FeedOrderBy.UpdatedAt,
  FeedOrderBy.CreatedAt,
]);
const FEED_CURSOR_PREFIX = "feed:";

type FeedWhereColumns = RelationsFilterColumns<
  KnownKeysOnly<typeof feeds, (typeof relations.feeds)["table"]>
>;

type FeedWhere = FeedWhereColumns & {
  AND?: FeedWhere[];
  OR?: FeedWhere[];
};

interface SerializableFeed {
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  translations: {
    createdAt: Date;
    updatedAt: Date;
  }[];
}

type SerializedTranslation<
  TTranslation extends SerializableFeed["translations"][number],
> = Omit<TTranslation, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type SerializedFeed<TFeed extends SerializableFeed> = Omit<
  TFeed,
  "createdAt" | "updatedAt" | "deletedAt" | "translations"
> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  translations: SerializedTranslation<TFeed["translations"][number]>[];
};

type InfiniteFeedParams = InfiniteDTO & {
  whereAnd?: FeedWhereColumns;
  locale?: Locale;
  enableDeleted?: boolean;
  userId?: string;
};

interface FeedCursorItem {
  id: number;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ParsedFeedCursor {
  value: Date | string | number;
  id?: number;
}

const parseFeedCursor = (
  cursor: string | number | null | undefined,
  orderBy: FeedOrderBy
): ParsedFeedCursor | null => {
  if (typeof cursor === "string" && cursor.startsWith(FEED_CURSOR_PREFIX)) {
    try {
      const parsed = JSON.parse(cursor.slice(FEED_CURSOR_PREFIX.length));
      if (
        Array.isArray(parsed) &&
        (typeof parsed[0] === "string" || typeof parsed[0] === "number") &&
        typeof parsed[1] === "number"
      ) {
        const value = parseCursorForOrder(
          parsed[0],
          orderBy,
          FEED_DATE_ORDER_BY
        );
        return value === null ? null : { value, id: parsed[1] };
      }
      return null;
    } catch {
      return null;
    }
  }

  const value = parseCursorForOrder(cursor, orderBy, FEED_DATE_ORDER_BY);
  return value === null ? null : { value };
};

const createFeedCursor = (
  item: FeedCursorItem,
  orderBy: FeedOrderBy
): string => {
  const rawValue = item[orderBy];
  const value = FEED_DATE_ORDER_BY.has(orderBy)
    ? dayjs(rawValue).valueOf()
    : rawValue;
  return `${FEED_CURSOR_PREFIX}${JSON.stringify([value, item.id])}`;
};

function serializeFeed<TFeed extends SerializableFeed>(
  feed: TFeed
): SerializedFeed<TFeed>;
function serializeFeed(feed: SerializableFeed) {
  const { createdAt, updatedAt, deletedAt, translations, ...feedData } = feed;

  return {
    ...feedData,
    createdAt: dayjs(createdAt).toISOString(),
    updatedAt: dayjs(updatedAt).toISOString(),
    deletedAt: deletedAt ? dayjs(deletedAt).toISOString() : null,
    translations: translations.map(
      ({ createdAt: at, updatedAt: upAt, ...translation }) => ({
        ...translation,
        createdAt: dayjs(at).toISOString(),
        updatedAt: dayjs(upAt).toISOString(),
      })
    ),
  };
}

const queryInfiniteFeeds = async (
  db: DB,
  {
    limit = 10,
    cursor,
    orderBy = FeedOrderBy.UpdatedAt,
    sortOrder = "desc",
    type = FeedType.Post,
    locale,
    whereAnd = {},
    withContent = false,
    enableDeleted = false,
    userId,
  }: InfiniteFeedParams
) => {
  const parsedCursor = parseFeedCursor(cursor, orderBy);
  const filters: FeedWhere[] = [whereAnd];

  if (userId !== undefined) {
    filters.push({ userId });
  }
  if (type !== FeedType.All) {
    filters.push({ type });
  }
  if (!enableDeleted) {
    filters.push({ deletedAt: { isNull: true } });
  }
  if (parsedCursor) {
    if (parsedCursor.id === undefined) {
      filters.push({
        [orderBy]: {
          [sortOrder === "asc" ? "gte" : "lte"]: parsedCursor.value,
        },
      } as FeedWhere);
    } else {
      const comparison = sortOrder === "asc" ? "gt" : "lt";
      const primaryFilter = {
        [orderBy]: {
          [comparison]: parsedCursor.value,
        },
      } as FeedWhere;
      filters.push(
        orderBy === FeedOrderBy.Id
          ? primaryFilter
          : {
              OR: [
                primaryFilter,
                {
                  AND: [
                    {
                      [orderBy]: parsedCursor.value,
                    } as FeedWhere,
                    {
                      id: {
                        [comparison]: parsedCursor.id,
                      },
                    },
                  ],
                },
              ],
            }
      );
    }
  }

  const rawItems = await db.query.feeds.findMany({
    orderBy: (feed, { asc, desc }) => {
      const order = sortOrder === "asc" ? asc : desc;
      const primaryOrder = order(feed[orderBy]);
      return orderBy === FeedOrderBy.Id
        ? [primaryOrder]
        : [primaryOrder, order(feed.id)];
    },
    limit: limit + 1,
    with: {
      translations: {
        where: {
          locale,
        },
        // skip the body unless it was asked for
        columns: withContent
          ? undefined
          : {
              content: false,
              source: false,
              unstableSerializedSource: false,
            },
        extras: {
          // "has ever been embedded": no `model` / `index_version` comparison, so
          // a vector left over from an older index key still counts. The exact
          // state per key comes from `libs/resources/stats.ts`.
          hasEmbedding: (translation, { sql }) =>
            sql<boolean>`exists (
              select 1 from chia_resource_chunk c
              join chia_resource_embedding e on e.chunk_id = c.id
              where c.feed_translation_id = ${translation.id}
            )`.as("has_embedding"),
        },
      },
      feedsToTags: {
        with: {
          tag: {
            with: {
              translations: {
                where: {
                  locale,
                },
              },
            },
          },
        },
      },
    },
    where: {
      AND: filters,
    },
  });

  const hasMore = rawItems.length > limit;
  const items = hasMore ? rawItems.slice(0, limit) : rawItems;
  const lastItem = items.at(-1);
  const nextCursor =
    hasMore && lastItem ? createFeedCursor(lastItem, orderBy) : null;

  return {
    items: items.map(serializeFeed),
    nextCursor,
  };
};

interface FeedDetailsScope {
  /**
   * Restrict to a single author. Callers serving the public site pass the configured
   * admin id so a feed belonging to anyone else is invisible.
   */
  userId?: string;
  /**
   * Restrict to published feeds. Public callers must set this — the detail query is
   * addressable by slug, so without it any draft is readable by anyone who knows or
   * guesses its slug.
   */
  published?: boolean;
}

const getFeedDetails = async (
  db: DB,
  identifier: { id: number } | { slug: string },
  locale?: Locale,
  enableDeleted = false,
  scope?: FeedDetailsScope
) => {
  const [feed] = await db
    .select()
    .from(feeds)
    .where(
      and(
        "id" in identifier
          ? eq(feeds.id, identifier.id)
          : eq(feeds.slug, identifier.slug),
        enableDeleted ? undefined : isNull(feeds.deletedAt),
        scope?.userId ? eq(feeds.userId, scope.userId) : undefined,
        scope?.published === undefined
          ? undefined
          : eq(feeds.published, scope.published)
      )
    )
    .limit(1)
    .$withCache({ config: { ex: 300 } });

  if (!feed) {
    return null;
  }

  const translationFilter = and(
    eq(feedTranslations.feedId, feed.id),
    locale ? eq(feedTranslations.locale, locale) : undefined
  );
  // the body lives on the translation row now, so this is one query instead of
  // two joined ones; the vector is selected as a boolean and never shipped
  const [feedTranslationRows, tagRows] = await Promise.all([
    db
      .select({
        id: feedTranslations.id,
        feedId: feedTranslations.feedId,
        locale: feedTranslations.locale,
        title: feedTranslations.title,
        excerpt: feedTranslations.excerpt,
        description: feedTranslations.description,
        summary: feedTranslations.summary,
        readTime: feedTranslations.readTime,
        content: feedTranslations.content,
        source: feedTranslations.source,
        unstableSerializedSource: feedTranslations.unstableSerializedSource,
        published: feedTranslations.published,
        deleted: feedTranslations.deleted,
        createdAt: feedTranslations.createdAt,
        updatedAt: feedTranslations.updatedAt,
        // "has ever been embedded", same as the list query above: not compared
        // against the current `(model, index_version)`; see
        // `libs/resources/stats.ts` for the per-key state.
        hasEmbedding: sql<boolean>`exists (
          select 1 from chia_resource_chunk c
          join chia_resource_embedding e on e.chunk_id = c.id
          where c.feed_translation_id = ${feedTranslations.id}
        )`,
      })
      .from(feedTranslations)
      .where(translationFilter)
      .$withCache({ config: { ex: 300 } }),
    db
      .select({
        feedId: feedsToTags.feedId,
        tagId: feedsToTags.tagId,
        tag: {
          id: tags.id,
          slug: tags.slug,
          createdAt: tags.createdAt,
          updatedAt: tags.updatedAt,
        },
        translation: {
          id: tagTranslations.id,
          tagId: tagTranslations.tagId,
          locale: tagTranslations.locale,
          name: tagTranslations.name,
          description: tagTranslations.description,
        },
      })
      .from(feedsToTags)
      .innerJoin(tags, eq(feedsToTags.tagId, tags.id))
      .leftJoin(
        tagTranslations,
        and(
          eq(tagTranslations.tagId, tags.id),
          locale ? eq(tagTranslations.locale, locale) : undefined
        )
      )
      .where(eq(feedsToTags.feedId, feed.id))
      .$withCache({ config: { ex: 300 } }),
  ]);

  const translations = feedTranslationRows;
  type TagRow = (typeof tagRows)[number];
  type FeedTag = Omit<TagRow, "translation"> & {
    tag: TagRow["tag"] & {
      translations: NonNullable<TagRow["translation"]>[];
    };
  };
  const feedTags = new Map<number, FeedTag>();

  for (const row of tagRows) {
    const existingTag = feedTags.get(row.tagId);
    if (existingTag) {
      if (row.translation) {
        existingTag.tag.translations.push(row.translation);
      }
      continue;
    }
    feedTags.set(row.tagId, {
      feedId: row.feedId,
      tagId: row.tagId,
      tag: {
        ...row.tag,
        translations: row.translation ? [row.translation] : [],
      },
    });
  }

  return serializeFeed({
    ...feed,
    translations,
    feedsToTags: [...feedTags.values()],
  });
};

export const getFeedBySlug = withDTO(
  async (
    db,
    params: {
      slug: string;
      locale?: Locale;
      enableDeleted?: boolean;
    } & FeedDetailsScope
  ) =>
    await getFeedDetails(
      db,
      { slug: params.slug },
      params.locale,
      params.enableDeleted,
      { userId: params.userId, published: params.published }
    )
);

export const getFeedById = withDTO(
  async (
    db,
    params: {
      feedId: number;
      locale?: Locale;
      enableDeleted?: boolean;
    } & FeedDetailsScope
  ) =>
    await getFeedDetails(
      db,
      { id: params.feedId },
      params.locale,
      params.enableDeleted,
      { userId: params.userId, published: params.published }
    )
);

export const getFeedForIndexing = withDTO(
  async (db, params: { feedId: number }) => {
    const rows = await db
      .select({
        feed: feeds,
        translation: {
          id: feedTranslations.id,
          locale: feedTranslations.locale,
          title: feedTranslations.title,
          excerpt: feedTranslations.excerpt,
          description: feedTranslations.description,
          summary: feedTranslations.summary,
          content: feedTranslations.content,
        },
      })
      .from(feeds)
      .innerJoin(feedTranslations, eq(feeds.id, feedTranslations.feedId))
      .where(eq(feeds.id, params.feedId));

    const firstRow = rows[0];
    if (!firstRow) {
      return null;
    }

    // tag names feed the document card's `Tags:` line, so they are needed per
    // locale alongside the translations
    const tagRows = await db
      .select({
        locale: tagTranslations.locale,
        name: tagTranslations.name,
      })
      .from(feedsToTags)
      .innerJoin(tags, eq(tags.id, feedsToTags.tagId))
      .innerJoin(tagTranslations, eq(tagTranslations.tagId, tags.id))
      .where(eq(feedsToTags.feedId, params.feedId));

    return {
      ...firstRow.feed,
      tags: tagRows,
      translations: rows.map(({ translation }) => translation),
    };
  }
);

/** Maps translation ids to the feed identity callers key off. */
export const getFeedRefsByTranslationIds = withDTO(
  async (db, params: { translationIds: number[] }) => {
    if (params.translationIds.length === 0) {
      return [];
    }
    return await db
      .select({
        translationId: feedTranslations.id,
        feedId: feedTranslations.feedId,
        slug: feeds.slug,
      })
      .from(feedTranslations)
      .innerJoin(feeds, eq(feeds.id, feedTranslations.feedId))
      .where(inArray(feedTranslations.id, params.translationIds));
  }
);

export const getPublicFeedSummariesByIds = withDTO(
  async (
    db,
    params: {
      feedIds: number[];
      locale: Locale;
    }
  ) => {
    if (params.feedIds.length === 0) {
      return [];
    }

    return await db
      .select({
        id: feeds.id,
        type: feeds.type,
        slug: feeds.slug,
        locale: feedTranslations.locale,
        title: feedTranslations.title,
        description: feedTranslations.description,
        excerpt: feedTranslations.excerpt,
      })
      .from(feeds)
      .innerJoin(feedTranslations, eq(feeds.id, feedTranslations.feedId))
      .where(
        and(
          inArray(feeds.id, params.feedIds),
          eq(feeds.published, true),
          isNull(feeds.deletedAt),
          eq(feedTranslations.locale, params.locale)
        )
      );
  }
);

export const getFeedIdByTranslationId = withDTO(
  async (db, params: { translationId: number }) => {
    const [translation] = await db
      .select({ feedId: feedTranslations.feedId })
      .from(feedTranslations)
      .where(eq(feedTranslations.id, params.translationId))
      .limit(1);

    return translation?.feedId ?? null;
  }
);

/**
 * Every translation id, ascending — what a full reindex iterates.
 *
 * Unfiltered on purpose: unpublished and soft-deleted feeds are indexed too, with
 * their visibility mirrored onto the chunks so BM25 can filter on it.
 */
export const listFeedTranslationIds = withDTO(
  async (db, _params: Record<string, never>) => {
    const rows = await db
      .select({ id: feedTranslations.id })
      .from(feedTranslations)
      .orderBy(feedTranslations.id);

    return rows.map((row) => row.id);
  }
);

/** The same population as {@link listFeedTranslationIds}, for the reindex preview. */
export const countFeedTranslations = withDTO(
  async (db, _params: Record<string, never>) => {
    const [row] = await db
      .select({ count: sql<number>`(count(*))::int` })
      .from(feedTranslations);

    return row?.count ?? 0;
  }
);

export const getInfiniteFeeds = withDTO(
  async (db, params: Omit<InfiniteFeedParams, "userId">) =>
    await queryInfiniteFeeds(db, params)
);

export const getInfiniteFeedsByUserId = withDTO(
  async (
    db,
    params: Omit<InfiniteFeedParams, "userId"> & {
      userId: string;
    }
  ) => await queryInfiniteFeeds(db, params)
);

export const createFeed = withDTO(
  async (
    db,
    dto: InsertFeedDTO & {
      // the body is part of the translation now, not a nested object
      translations: InsertFeedTranslationDTO[];
    }
  ) => {
    return await db.transaction(async (trx) => {
      const [feed] = await trx
        .insert(feeds)
        .values({
          slug: dto.slug,
          type: dto.type,
          contentType: dto.contentType,
          published: dto.published,
          defaultLocale: dto.defaultLocale ?? LocaleEnum.zhTW,
          userId: dto.userId,
          mainImage: dto.mainImage,
          createdAt: dto.createdAt ? dayjs(dto.createdAt).toDate() : undefined,
          updatedAt: dto.updatedAt ? dayjs(dto.updatedAt).toDate() : undefined,
        })
        .returning();

      if (!feed?.id) {
        throw new Error("Failed to create feed");
      }

      const translationValues = dto.translations.map((translation) => ({
        feedId: feed.id,
        locale: translation.locale,
        title: translation.title,
        excerpt: translation.excerpt,
        description: translation.description,
        summary: translation.summary,
        readTime: translation.readTime,
        content: translation.content,
        source: translation.source,
        unstableSerializedSource: translation.unstableSerializedSource,
        // mirrors `feed` so BM25 can filter without a join
        published: feed.published,
        deleted: !!feed.deletedAt,
      }));
      const createdTranslations =
        translationValues.length > 0
          ? await trx
              .insert(feedTranslations)
              .values(translationValues)
              .returning()
          : [];
      const translationIds = new Map(
        createdTranslations.map((translation) => [
          translation.locale,
          translation.id,
        ])
      );
      for (const translation of dto.translations) {
        if (!translationIds.get(translation.locale)) {
          throw new Error(
            `Failed to create feed translation for locale "${translation.locale}"`
          );
        }
      }

      return {
        ...feed,
        translations: createdTranslations,
      };
    });
  }
);

export const updateFeed = withDTO(
  async (db, dto: { feedId: number } & Partial<UpdateFeedDTO>) => {
    const [updatedFeed] = await db
      .update(feeds)
      .set({
        slug: dto.slug,
        type: dto.type,
        contentType: dto.contentType,
        published: dto.published,
        defaultLocale: dto.defaultLocale,
        mainImage: dto.mainImage,
        updatedAt: dto.updatedAt ? dayjs(dto.updatedAt).toDate() : new Date(),
      })
      .where(eq(feeds.id, dto.feedId))
      .returning();

    return updatedFeed;
  }
);

export const upsertFeedTranslation = withDTO(
  async (
    db,
    dto: {
      feedId: number;
      locale: Locale;
    } & Partial<InsertFeedTranslationDTO>
  ) => {
    const [translation] = await db
      .insert(feedTranslations)
      .values({
        feedId: dto.feedId,
        locale: dto.locale,
        title: dto.title ?? "",
        excerpt: dto.excerpt,
        description: dto.description,
        summary: dto.summary,
        readTime: dto.readTime,
      })
      .onConflictDoUpdate({
        target: [feedTranslations.feedId, feedTranslations.locale],
        set: {
          title: dto.title,
          excerpt: dto.excerpt,
          description: dto.description,
          summary: dto.summary,
          readTime: dto.readTime,
          updatedAt: new Date(),
        },
      })
      .returning();

    return translation;
  }
);

export const updateFeedTranslation = withDTO(
  async (
    db,
    dto: {
      translationId: number;
    } & Partial<UpdateFeedTranslationDTO>
  ) => {
    const [updated] = await db
      .update(feedTranslations)
      .set({
        title: dto.title,
        excerpt: dto.excerpt,
        description: dto.description,
        summary: dto.summary,
        readTime: dto.readTime,
        updatedAt: new Date(),
      })
      .where(eq(feedTranslations.id, dto.translationId))
      .returning();

    return updated;
  }
);

/**
 * Writes a translation's body.
 *
 * Kept as its own function because callers update the body independently of the
 * metadata, but it is now a plain `UPDATE` on the translation row — which is
 * also what refreshes the BM25 index, since that index is built on this table.
 */
export const upsertContent = withDTO(
  async (
    db,
    dto: {
      feedTranslationId: number;
      content?: string | null;
      source?: string | null;
      unstableSerializedSource?: string | null;
    }
  ) => {
    const [row] = await db
      .update(feedTranslations)
      .set({
        content: dto.content,
        source: dto.source,
        unstableSerializedSource: dto.unstableSerializedSource,
        updatedAt: new Date(),
      })
      .where(eq(feedTranslations.id, dto.feedTranslationId))
      .returning({
        feedTranslationId: feedTranslations.id,
        content: feedTranslations.content,
        source: feedTranslations.source,
        unstableSerializedSource: feedTranslations.unstableSerializedSource,
      });

    return row;
  }
);

export const softDeleteFeed = withDTO(async (db, dto: { feedId: number }) => {
  const [updated] = await db
    .update(feeds)
    .set({ deletedAt: new Date() })
    .where(eq(feeds.id, dto.feedId))
    .returning();
  return updated;
});

export const restoreFeed = withDTO(async (db, dto: { feedId: number }) => {
  const [updated] = await db
    .update(feeds)
    .set({ deletedAt: null })
    .where(eq(feeds.id, dto.feedId))
    .returning();
  return updated;
});

export const deleteFeed = withDTO(async (db, dto: { feedId: number }) => {
  await db.delete(feeds).where(eq(feeds.id, dto.feedId));
});

export const deleteFeedTranslation = withDTO(
  async (db, dto: { translationId: number }) => {
    await db
      .delete(feedTranslations)
      .where(eq(feedTranslations.id, dto.translationId));
  }
);
