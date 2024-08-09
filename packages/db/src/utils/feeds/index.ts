import dayjs from "dayjs";
import type { SQLWrapper } from "drizzle-orm";

import type { DB } from "../..";
import type { InfiniteDTO } from "../validator/feeds";

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
      if (
        cursor instanceof dayjs.Dayjs ||
        orderBy === "createdAt" ||
        orderBy === "updatedAt"
      ) {
        return dayjs(cursor).toDate();
      }
      return cursor;
    };
    const feedType =
      type === "post"
        ? ({
            post: true,
          } as const)
        : ({
            note: true,
          } as const);
    const items = await db.query.feeds.findMany({
      orderBy: (feeds, { asc, desc }) => [
        sortOrder === "asc" ? asc(feeds[orderBy]) : desc(feeds[orderBy]),
      ],
      limit: limit + 1,
      with: feedType,
      where: cursor
        ? (feeds, { gte, lte, eq, and }) =>
            and(
              sortOrder === "asc"
                ? gte(feeds[orderBy], cursorTransform(cursor))
                : lte(feeds[orderBy], cursorTransform(cursor)),
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
      if (
        cursor instanceof dayjs.Dayjs ||
        orderBy === "createdAt" ||
        orderBy === "updatedAt"
      ) {
        return dayjs(cursor).toDate();
      }
      return cursor;
    };
    const feedType =
      type === "post"
        ? ({
            post: true,
          } as const)
        : ({
            note: true,
          } as const);
    const items = await db.query.feeds.findMany({
      orderBy: (feeds, { asc, desc }) => [
        sortOrder === "asc" ? asc(feeds[orderBy]) : desc(feeds[orderBy]),
      ],
      limit: limit + 1,
      with: feedType,
      where: cursor
        ? (feeds, { gte, lte, eq, and }) =>
            and(
              sortOrder === "asc"
                ? gte(feeds[orderBy], cursorTransform(cursor))
                : lte(feeds[orderBy], cursorTransform(cursor)),
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
