import dayjs from "dayjs";
import type { SQLWrapper } from "drizzle-orm";
import {
  eq, // sql,
  // cosineDistance,
  // desc,
  // gt
} from "drizzle-orm";

// import { generateEmbedding } from "@chia/ai/embeddings/openai";
import type { Options } from "@chia/ai/embeddings/openai";

import { cursorTransform, dateToTimestamp, withDTO } from "../";
import { schema } from "../..";
import { FeedOrderBy, FeedType } from "../../types";
import type {
  InfiniteDTO,
  InsertFeedDTO,
  InsertFeedContentDTO,
} from "../validator/feeds";

export const getFeedBySlug = withDTO((db, slug: string) => {
  return db.query.feeds.findFirst({
    where: (feeds, { eq }) => eq(feeds.slug, slug),
    with: {
      content: true,
    },
  });
});

export const getFeedById = withDTO((db, feedId: number) => {
  return db.query.feeds.findFirst({
    where: (feeds, { eq }) => eq(feeds.id, feedId),
    with: {
      content: true,
    },
  });
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
      with: withContent
        ? {
            content: true,
          }
        : {},
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
    return {
      items,
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
      with: withContent
        ? {
            content: true,
          }
        : {},
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
    return {
      items,
      nextCursor,
    };
  }
);

export const createFeed = withDTO<
  InsertFeedDTO & Omit<InsertFeedContentDTO, "feedId">,
  void
>(async (db, dto) => {
  await db.transaction(async (trx) => {
    const feedId = (
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
          createdAt: dto.createdAt ? dayjs(dto.createdAt).toDate() : undefined,
          updatedAt: dto.updatedAt ? dayjs(dto.updatedAt).toDate() : undefined,
        })
        .returning({ feedId: schema.feeds.id })
    )[0]?.feedId;
    if (!feedId) {
      throw new Error("Failed to create feed");
    }
    await trx.insert(schema.contents).values({
      feedId,
      content: dto.content,
      source: dto.source,
      unstable_serializedSource: dto.unstable_serializedSource,
    });
  });
});

export const updateFeed = withDTO<
  { feedId: number } & Partial<
    InsertFeedDTO & Omit<InsertFeedContentDTO, "feedId">
  >,
  void
>(async (db, dto) => {
  await db.transaction(async (trx) => {
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
        createdAt: dto.createdAt ? dayjs(dto.createdAt).toDate() : undefined,
        updatedAt: dto.updatedAt ? dayjs(dto.updatedAt).toDate() : undefined,
      })
      .where(eq(schema.feeds.id, dto.feedId));
    await trx
      .update(schema.contents)
      .set({
        content: dto.content,
        source: dto.source,
        unstable_serializedSource: dto.unstable_serializedSource,
      })
      .where(eq(schema.contents.feedId, dto.feedId));
  });
});

export const deleteFeed = withDTO<{ feedId: number }, void>(async (db, dto) => {
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
    // const embedding = await generateEmbedding(dto.input, dto);
    // const similarity = sql<number>`1 - (${cosineDistance(schema.feeds.embedding, embedding)})`;

    return (
      db
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
          // similarity,
        })
        .from(schema.feeds)
        // .where(gt(similarity, dto.comparison ?? 0.5))
        // .orderBy((t) => desc(t.similarity))
        .limit(dto.limit ?? 5)
    );
  }
);
