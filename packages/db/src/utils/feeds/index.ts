import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import type { SQLWrapper } from "drizzle-orm";

import { schema } from "../..";
import type { DB } from "../..";
import type { GetDTO, InfiniteDTO } from "../validator/feeds";

const withDTO = <TDto = unknown, TResult = unknown>(
  fn: (db: DB, dto: TDto) => Promise<TResult>
) => {
  return async (db: DB, dto: TDto) => {
    return await fn(db, dto);
  };
};

export const getFeeds = withDTO(
  async (
    db,
    {
      take = 10,
      skip = 0,
      orderBy = "updatedAt",
      sortOrder = "desc",
      type = "post",
      whereAnd = [],
    }: GetDTO & {
      whereAnd?: (SQLWrapper | undefined)[];
    }
  ) => {
    const feedType =
      type === "post"
        ? ({
            post: true,
          } as const)
        : ({
            note: true,
          } as const);
    return db.query.feeds.findMany({
      orderBy: (feeds, { asc, desc }) => [
        sortOrder === "asc" ? asc(feeds[orderBy]) : desc(feeds[orderBy]),
      ],
      limit: take,
      offset: skip,
      where: (feeds, { eq, and }) => and(eq(feeds.type, type), ...whereAnd),
      with: feedType,
    });
  }
);

/**
 * @deprecated use getFeedById instead
 */
export const getByFeedId = withDTO((db, id: number) => {
  return db
    .select()
    .from(schema.feeds)
    .where(eq(schema.feeds.id, Number(id)));
});

export const getFeedById = withDTO(
  (db, { id, type }: { id: number; type: "post" | "note" }) => {
    return db.query.feeds.findFirst({
      where: (feeds, { eq }) => eq(feeds.id, id),
      with: {
        [type]: true,
      },
    });
  }
);

/**
 * @deprecated use getFeedBySlug instead
 */
export const getByFeedSlug = withDTO((db, slug: string) => {
  return db.select().from(schema.feeds).where(eq(schema.feeds.slug, slug));
});

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

export const getFeedsByUserId = withDTO(
  async (
    db,
    {
      take = 10,
      skip = 0,
      orderBy = "updatedAt",
      sortOrder = "desc",
      type = "post",
      userId,
      whereAnd = [],
    }: GetDTO & {
      userId: string;
      whereAnd?: (SQLWrapper | undefined)[];
    }
  ) => {
    const feedType =
      type === "post"
        ? ({
            post: true,
          } as const)
        : ({
            note: true,
          } as const);
    return db.query.feeds.findMany({
      orderBy: (feeds, { asc, desc }) => [
        sortOrder === "asc" ? asc(feeds[orderBy]) : desc(feeds[orderBy]),
      ],
      limit: take,
      offset: skip,
      where: (feeds, { eq, and }) =>
        and(eq(feeds.type, type), eq(feeds.userId, userId), ...whereAnd),
      with: feedType,
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
