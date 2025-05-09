import type { SQLWrapper } from "drizzle-orm";
import { eq, sql, cosineDistance, desc, gt } from "drizzle-orm";

import { generateEmbedding } from "@chia/ai/embeddings/openai";
import type { Options } from "@chia/ai/embeddings/openai";
import dayjs from "@chia/utils/day";

import { cursorTransform, dateToTimestamp, withDTO } from "../";
import { schema } from "../..";
import { FeedOrderBy, FeedType } from "../../types";
import type {
  InfiniteDTO,
  InsertFeedDTO,
  InsertFeedContentDTO,
  InsertFeedMetaDTO,
  UpdateFeedDTO,
  UpdateFeedContentDTO,
} from "../validator/feeds";

export const getFeedBySlug = withDTO(async (db, slug: string) => {
  const feed = await db.query.feeds.findFirst({
    where: (feeds, { eq }) => eq(feeds.slug, slug),
    with: {
      content: true,
      feedMeta: true,
    },
  });
  if (!feed) {
    return null;
  }
  return {
    ...feed,
    createdAt: dayjs(feed.createdAt).toISOString(),
    updatedAt: dayjs(feed.updatedAt).toISOString(),
  };
});

export const getFeedById = withDTO(async (db, feedId: number) => {
  const feed = await db.query.feeds.findFirst({
    where: (feeds, { eq }) => eq(feeds.id, feedId),
    with: {
      content: true,
      feedMeta: true,
    },
  });
  if (!feed) {
    return null;
  }
  return {
    ...feed,
    createdAt: dayjs(feed.createdAt).toISOString(),
    updatedAt: dayjs(feed.updatedAt).toISOString(),
  };
});

export const getInfiniteFeeds = withDTO(
  async (
    db,
    {
      limit = 10,
      cursor,
      orderBy = FeedOrderBy.UpdatedAt,
      sortOrder = "desc",
      type = FeedType.Post,
      whereAnd = [],
      withContent,
    }: InfiniteDTO & {
      whereAnd?: (SQLWrapper | undefined)[];
    }
  ) => {
    const parsedCursor = cursor
      ? cursorTransform(
          cursor,
          orderBy === FeedOrderBy.UpdatedAt || orderBy === FeedOrderBy.CreatedAt
            ? "timestamp"
            : "default"
        )
      : null;
    const items = await db.query.feeds.findMany({
      orderBy: (feeds, { asc, desc }) => [
        sortOrder === "asc" ? asc(feeds[orderBy]) : desc(feeds[orderBy]),
      ],
      limit: limit + 1,
      with: {
        content: withContent ? true : undefined,
      },
      where: parsedCursor
        ? (feeds, { gte, lte, eq, and }) =>
            and(
              sortOrder === "asc"
                ? gte(feeds[orderBy], parsedCursor)
                : lte(feeds[orderBy], parsedCursor),
              type === "all" ? undefined : eq(feeds.type, type),
              ...whereAnd
            )
        : (feeds, { eq, and }) =>
            and(type === "all" ? undefined : eq(feeds.type, type), ...whereAnd),
    });
    let nextCursor: ReturnType<typeof cursorTransform> | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor =
        orderBy === FeedOrderBy.UpdatedAt || orderBy === FeedOrderBy.CreatedAt
          ? dateToTimestamp(nextItem?.[orderBy] as dayjs.ConfigType)
          : nextItem?.[orderBy];
    }
    const serializedItems = items.map((item) => ({
      ...item,
      createdAt: dayjs(item.createdAt).toISOString(),
      updatedAt: dayjs(item.updatedAt).toISOString(),
    }));
    return {
      items: serializedItems,
      nextCursor,
    };
  }
);

export const getInfiniteFeedsByUserId = withDTO(
  async (
    db,
    {
      limit = 10,
      cursor,
      orderBy = FeedOrderBy.UpdatedAt,
      sortOrder = "desc",
      type = FeedType.Post,
      userId,
      whereAnd = [],
      withContent,
    }: InfiniteDTO & {
      userId: string;
      whereAnd?: (SQLWrapper | undefined)[];
    }
  ) => {
    const parsedCursor = cursor
      ? cursorTransform(
          cursor,
          orderBy === FeedOrderBy.UpdatedAt || orderBy === FeedOrderBy.CreatedAt
            ? "timestamp"
            : "default"
        )
      : null;
    const items = await db.query.feeds.findMany({
      orderBy: (feeds, { asc, desc }) => [
        sortOrder === "asc" ? asc(feeds[orderBy]) : desc(feeds[orderBy]),
      ],
      limit: limit + 1,
      with: {
        content: withContent ? true : undefined,
      },
      where: parsedCursor
        ? (feeds, { gte, lte, eq, and }) =>
            and(
              sortOrder === "asc"
                ? gte(feeds[orderBy], parsedCursor)
                : lte(feeds[orderBy], parsedCursor),
              type === "all" ? undefined : eq(feeds.type, type),
              eq(feeds.userId, userId),
              ...whereAnd
            )
        : (feeds, { eq, and }) =>
            and(
              type === "all" ? undefined : eq(feeds.type, type),
              eq(feeds.userId, userId),
              ...whereAnd
            ),
    });
    let nextCursor: ReturnType<typeof cursorTransform> | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor =
        orderBy === FeedOrderBy.UpdatedAt || orderBy === FeedOrderBy.CreatedAt
          ? dateToTimestamp(nextItem?.[orderBy] as dayjs.ConfigType)
          : nextItem?.[orderBy];
    }
    const serializedItems = items.map((item) => ({
      ...item,
      createdAt: dayjs(item.createdAt).toISOString(),
      updatedAt: dayjs(item.updatedAt).toISOString(),
    }));
    return {
      items: serializedItems,
      nextCursor,
    };
  }
);

export const createFeed = withDTO(
  async (db, dto: InsertFeedDTO & Omit<InsertFeedContentDTO, "feedId">) => {
    return await db.transaction(async (trx) => {
      const feed = (
        await trx
          .insert(schema.feeds)
          .values({
            slug: dto.slug,
            type: dto.type,
            contentType: dto.contentType ?? undefined,
            title: dto.title,
            excerpt: dto.excerpt,
            description: dto.description,
            userId: dto.userId,
            published: dto.published,
            createdAt: dto.createdAt
              ? dayjs(dto.createdAt).toDate()
              : undefined,
            updatedAt: dto.updatedAt
              ? dayjs(dto.updatedAt).toDate()
              : undefined,
            embedding: dto.embedding,
          })
          .returning()
      )[0];
      if (!feed.id) {
        trx.rollback();
      }
      const content = (
        await trx
          .insert(schema.contents)
          .values({
            feedId: feed.id,
            content: dto.content,
            source: dto.source,
            unstable_serializedSource: dto.unstable_serializedSource,
          })
          .returning()
      )[0];
      if (!content.id) {
        trx.rollback();
      }
      return Object.assign(feed, content);
    });
  }
);

export const updateFeed = withDTO(
  async (
    db,
    dto: { feedId: number } & Partial<
      UpdateFeedDTO & Omit<UpdateFeedContentDTO, "feedId">
    >
  ) => {
    return await db.transaction(async (trx) => {
      const feed = (
        await trx
          .update(schema.feeds)
          .set({
            slug: dto.slug,
            type: dto.type,
            contentType: dto.contentType ?? undefined,
            title: dto.title,
            excerpt: dto.excerpt,
            description: dto.description,
            userId: dto.userId,
            published: dto.published,
            createdAt: dto.createdAt
              ? dayjs(dto.createdAt).toDate()
              : undefined,
            updatedAt: dto.updatedAt
              ? dayjs(dto.updatedAt).toDate()
              : undefined,
            embedding: dto.embedding,
          })
          .where(eq(schema.feeds.id, dto.feedId))
          .returning()
      )[0];
      if (!feed.id) {
        trx.rollback();
      }
      if (!dto.content || !dto.source || !dto.unstable_serializedSource) {
        return feed;
      }
      const content = (
        await trx
          .update(schema.contents)
          .set({
            content: dto.content,
            source: dto.source,
            unstable_serializedSource: dto.unstable_serializedSource,
          })
          .where(eq(schema.contents.feedId, dto.feedId))
          .returning()
      )[0];
      if (!content.id) {
        trx.rollback();
      }
      return Object.assign(feed, content);
    });
  }
);

export const deleteFeed = withDTO(async (db, dto: { feedId: number }) => {
  await db.transaction(async (trx) => {
    await trx.delete(schema.feeds).where(eq(schema.feeds.id, dto.feedId));
    await trx
      .delete(schema.contents)
      .where(eq(schema.contents.feedId, dto.feedId));
  });
});

export const searchFeeds = withDTO(
  async (
    db,
    dto: Options & { input: string; limit?: number; comparison?: number }
  ) => {
    const embedding = await generateEmbedding(dto.input, dto);
    const similarity = sql<number>`1 - (${cosineDistance(schema.feeds.embedding, embedding)})`;

    return db
      .select({
        id: schema.feeds.id,
        userId: schema.feeds.userId,
        type: schema.feeds.type,
        slug: schema.feeds.slug,
        description: schema.feeds.description,
        createdAt: schema.feeds.createdAt,
        updatedAt: schema.feeds.updatedAt,
        readTime: schema.feeds.readTime,
        contentType: schema.feeds.contentType,
        published: schema.feeds.published,
        title: schema.feeds.title,
        excerpt: schema.feeds.excerpt,
        similarity,
      })
      .from(schema.feeds)
      .where(gt(similarity, dto.comparison ?? 0.5))
      .orderBy((t) => desc(t.similarity))
      .limit(dto.limit ?? 5);
  }
);

export const getFeedMetaById = withDTO(
  async (
    db,
    dto: {
      feedId: number;
      withContent?: boolean;
    }
  ) => {
    const feedMeta = await db.query.feedMeta.findFirst({
      where: (feeds, { eq }) => eq(feeds.feedId, dto.feedId),
      with: {
        feed: {
          with: {
            content: dto.withContent ? true : undefined,
          },
        },
      },
    });
    if (!feedMeta) {
      return null;
    }
    return {
      ...feedMeta,
      feed: {
        ...feedMeta.feed,
        createdAt: dayjs(feedMeta.feed.createdAt).toISOString(),
        updatedAt: dayjs(feedMeta.feed.updatedAt).toISOString(),
      },
    };
  }
);

export const createFeedMeta = withDTO(async (db, dto: InsertFeedMetaDTO) => {
  await db.transaction(async (trx) => {
    await trx.insert(schema.feedMeta).values(dto);
  });
});

export const updateFeedMeta = withDTO(async (db, dto: InsertFeedMetaDTO) => {
  await db.transaction(async (trx) => {
    await trx
      .update(schema.feedMeta)
      .set(dto)
      .where(eq(schema.feedMeta.feedId, dto.feedId));
  });
});
