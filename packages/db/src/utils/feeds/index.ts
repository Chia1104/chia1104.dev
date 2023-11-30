import { type DB } from "../..";
import dayjs from "dayjs";
import { type SQLWrapper } from "drizzle-orm";
import type { GetDTO, InfiniteDTO } from "../validator/feeds";

let instance: FeedsAPI | undefined;

/**
 * @deprecated
 */
export class FeedsAPI {
  private db: DB;

  constructor(db: DB) {
    if (instance) {
      throw new Error("You can only create one instance!");
    }
    this.db = db;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    instance = this;
  }

  async getFeeds({
    take = 10,
    skip = 0,
    orderBy = "updatedAt",
    sortOrder = "desc",
    type = "post",
    whereAnd = [],
  }: GetDTO & {
    whereAnd?: (SQLWrapper | undefined)[];
  }) {
    const feedType =
      type === "post"
        ? ({
            post: true,
          } as const)
        : ({
            note: true,
          } as const);
    return this.db.query.feeds.findMany({
      orderBy: (feeds, { asc, desc }) => [
        sortOrder === "asc" ? asc(feeds[orderBy]) : desc(feeds[orderBy]),
      ],
      limit: take,
      offset: skip,
      where: (feeds, { eq, and }) => and(eq(feeds.type, type), ...whereAnd),
      with: feedType,
    });
  }

  async getFeedsByUserId({
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
  }) {
    const feedType =
      type === "post"
        ? ({
            post: true,
          } as const)
        : ({
            note: true,
          } as const);
    return this.db.query.feeds.findMany({
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

  async getInfiniteFeeds({
    limit = 10,
    cursor,
    orderBy = "updatedAt",
    sortOrder = "desc",
    type = "post",
    whereAnd = [],
  }: InfiniteDTO & {
    whereAnd?: (SQLWrapper | undefined)[];
  }) {
    const cursorTransform = (cursor: any) => {
      if (orderBy === "createdAt" || orderBy === "updatedAt") {
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
    const items = await this.db.query.feeds.findMany({
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

  async getInfiniteFeedsByUserId({
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
  }) {
    const cursorTransform = (cursor: any) => {
      if (orderBy === "createdAt" || orderBy === "updatedAt") {
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
    const items = await this.db.query.feeds.findMany({
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
}

export const getFeeds = async (
  db: DB,
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
};

export const getFeedsByUserId = async (
  db: DB,
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
};

export const getInfiniteFeeds = async (
  db: DB,
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
  const cursorTransform = (cursor: any) => {
    if (orderBy === "createdAt" || orderBy === "updatedAt") {
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
};

export const getInfiniteFeedsByUserId = async (
  db: DB,
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
  const cursorTransform = (cursor: any) => {
    if (orderBy === "createdAt" || orderBy === "updatedAt") {
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
};
