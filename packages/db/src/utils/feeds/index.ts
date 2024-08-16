import type { SQLWrapper } from "drizzle-orm";

import { cursorTransform, dateToTimestamp, withDTO } from "../";
import { schema } from "../..";
import type {
  InfiniteDTO,
  InsertFeedDTO,
  InsertFeedContentDTO,
} from "../validator/feeds";

export const getFeedBySlug = withDTO(
  (db, { slug, type }: { slug: string; type: "post" | "note" }) => {
    return db.query.feeds.findFirst({
      where: (feeds, { eq }) => eq(feeds.slug, slug),
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
      orderBy = "updatedAt",
      sortOrder = "desc",
      type = "post",
      whereAnd = [],
    }: InfiniteDTO & {
      whereAnd?: (SQLWrapper | undefined)[];
    }
  ) => {
    const parsedCursor = cursor
      ? cursorTransform(
          cursor,
          // @ts-expect-error
          orderBy === "updatedAt" || orderBy === "updatedAt"
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
        type === "post"
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
        // @ts-expect-error
        orderBy === "updatedAt" || orderBy === "updatedAt"
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
      orderBy = "updatedAt",
      sortOrder = "desc",
      type = "post",
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
          // @ts-expect-error
          orderBy === "updatedAt" || orderBy === "updatedAt"
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
        type === "post"
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
        // @ts-expect-error
        orderBy === "updatedAt" || orderBy === "updatedAt"
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
