import dayjs from "dayjs";
import type { SQLWrapper } from "drizzle-orm";

import { DB, schema } from "../..";
import type {
  InfiniteDTO,
  InsertFeedDTO,
  InsertFeedContentDTO,
} from "../validator/feeds";

const withDTO = <TDto = unknown, TResult = unknown>(
  fn: (db: DB, dto: TDto) => Promise<TResult>
) => {
  return async (db: DB, dto: TDto) => {
    return await fn(db, dto);
  };
};

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
    const cursorTransform = (cursor: string | number | Date | dayjs.Dayjs) => {
      try {
        if (
          cursor instanceof dayjs.Dayjs ||
          orderBy === "createdAt" ||
          orderBy === "updatedAt"
        ) {
          return dayjs(cursor).toDate();
        }
        return cursor;
      } catch (e) {
        console.error(e);
        return null;
      }
    };
    const feedType =
      type === "post"
        ? ({
            post: true,
          } as const)
        : ({
            note: true,
          } as const);
    const parsedCursor = cursor ? cursorTransform(cursor) : null;
    const items = await db.query.feeds.findMany({
      orderBy: (feeds, { asc, desc }) => [
        sortOrder === "asc" ? asc(feeds[orderBy]) : desc(feeds[orderBy]),
      ],
      limit: limit + 1,
      with: feedType,
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
    let nextCursor: typeof cursor | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.[orderBy];
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
    const cursorTransform = (cursor: string | number | Date | dayjs.Dayjs) => {
      try {
        if (
          cursor instanceof dayjs.Dayjs ||
          orderBy === "createdAt" ||
          orderBy === "updatedAt"
        ) {
          return dayjs(cursor).toDate();
        }
        return cursor;
      } catch (e) {
        console.error(e);
        return null;
      }
    };
    const feedType =
      type === "post"
        ? ({
            post: true,
          } as const)
        : ({
            note: true,
          } as const);
    const parsedCursor = cursor ? cursorTransform(cursor) : null;
    const items = await db.query.feeds.findMany({
      orderBy: (feeds, { asc, desc }) => [
        sortOrder === "asc" ? asc(feeds[orderBy]) : desc(feeds[orderBy]),
      ],
      limit: limit + 1,
      with: feedType,
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
    let nextCursor: typeof cursor | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.[orderBy];
    }
    return {
      items,
      nextCursor,
    };
  }
);

export const createFeed = withDTO<
  InsertFeedDTO & Pick<InsertFeedContentDTO, "content">,
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
    });
  });
});
