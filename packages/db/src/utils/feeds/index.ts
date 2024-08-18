import type { SQLWrapper } from "drizzle-orm";
import { eq } from "drizzle-orm";

import { cursorTransform, dateToTimestamp, withDTO } from "../";
import { schema } from "../..";
import { FeedOrderBy, FeedType } from "../../types";
import type {
  InfiniteDTO,
  InsertFeedDTO,
  InsertFeedContentDTO,
} from "../validator/feeds";

export const getFeedBySlug = withDTO(
  (db, { slug, type }: { slug: string; type: FeedType }) => {
    return db.query.feeds.findFirst({
      where: (feeds, { eq }) => eq(feeds.slug, slug),
      with: {
        [type]: true,
      },
    });
  }
);

export const getFeedById = withDTO(
  (db, { feedId, type }: { feedId: number; type: FeedType }) => {
    return db.query.feeds.findFirst({
      where: (feeds, { eq }) => eq(feeds.id, feedId),
      with: {
        [type]: true,
      },
    });
  }
);

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
      with:
        type === FeedType.Post
          ? ({
              post: true,
            } as const)
          : ({
              note: true,
            } as const),
      where: parsedCursor
        ? (feeds, { gte, lte, eq, and }) =>
            and(
              sortOrder === "asc"
                ? gte(feeds[orderBy], parsedCursor)
                : lte(feeds[orderBy], parsedCursor),
              eq(feeds.type, type),
              ...whereAnd
            )
        : (feeds, { eq, and }) => and(eq(feeds.type, type), ...whereAnd),
    });
    let nextCursor: ReturnType<typeof cursorTransform> | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor =
        orderBy === FeedOrderBy.UpdatedAt || orderBy === FeedOrderBy.CreatedAt
          ? dateToTimestamp(nextItem?.[orderBy])
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
      with:
        type === FeedType.Post
          ? ({
              post: true,
            } as const)
          : ({
              note: true,
            } as const),
      where: parsedCursor
        ? (feeds, { gte, lte, eq, and }) =>
            and(
              sortOrder === "asc"
                ? gte(feeds[orderBy], parsedCursor)
                : lte(feeds[orderBy], parsedCursor),
              eq(feeds.type, type),
              eq(feeds.userId, userId),
              ...whereAnd
            )
        : (feeds, { eq, and }) =>
            and(eq(feeds.type, type), eq(feeds.userId, userId), ...whereAnd),
    });
    let nextCursor: ReturnType<typeof cursorTransform> | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor =
        orderBy === FeedOrderBy.UpdatedAt || orderBy === FeedOrderBy.CreatedAt
          ? dateToTimestamp(nextItem?.[orderBy])
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
    await trx.insert(dto.type === "note" ? schema.notes : schema.posts).values({
      feedId: (
        await trx
          .insert(schema.feeds)
          .values({
            slug: dto.slug,
            type: dto.type,
            title: dto.title,
            excerpt: dto.excerpt,
            description: dto.description,
            userId: dto.userId,
            published: dto.published,
          })
          .returning({ feedId: schema.feeds.id })
      )[0].feedId,
      content: dto.content,
      type: dto.contentType,
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
        title: dto.title,
        excerpt: dto.excerpt,
        description: dto.description,
        published: dto.published,
      })
      .where(eq(schema.feeds.id, dto.feedId));
    await trx
      .update(dto.type === "note" ? schema.notes : schema.posts)
      .set({
        content: dto.content,
        type: dto.contentType,
      })
      .where(
        eq(
          dto.type === "note" ? schema.notes.feedId : schema.posts.feedId,
          dto.feedId
        )
      );
  });
});

export const deleteFeed = withDTO<{ feedId: number }, void>(async (db, dto) => {
  await db.transaction(async (trx) => {
    await trx.delete(schema.feeds).where(eq(schema.feeds.id, dto.feedId));
    await trx.delete(schema.posts).where(eq(schema.posts.feedId, dto.feedId));
    await trx.delete(schema.notes).where(eq(schema.notes.feedId, dto.feedId));
  });
});
