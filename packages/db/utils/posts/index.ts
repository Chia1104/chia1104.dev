import { type DB } from "../..";
import dayjs from "dayjs";

export class PostsAPI {
  private db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  async getPosts(opts: {
    take: number;
    skip: number;
    orderBy: "createdAt" | "updatedAt" | "id" | "slug" | "title";
    sortOrder: "asc" | "desc";
  }) {
    return this.db.query.feeds.findMany({
      orderBy: (feeds, { asc, desc }) => [
        opts.sortOrder === "asc"
          ? asc(feeds[opts.orderBy])
          : desc(feeds[opts.orderBy]),
      ],
      limit: opts.take,
      offset: opts.skip,
      with: {
        posts: true,
      },
    });
  }

  async getInfinitePosts(opts: {
    limit: number;
    cursor?: any;
    orderBy: "createdAt" | "updatedAt" | "id" | "slug" | "title";
    sortOrder: "asc" | "desc";
  }) {
    const { cursor, orderBy, sortOrder, limit } = opts;
    const cursorTransform = (cursor: any) => {
      if (orderBy === "createdAt" || orderBy === "updatedAt") {
        return dayjs(cursor).toDate();
      }
      return cursor;
    };
    const items = await this.db.query.feeds.findMany({
      orderBy: (feeds, { asc, desc }) => [
        sortOrder === "asc" ? asc(feeds[orderBy]) : desc(feeds[orderBy]),
      ],
      limit: limit + 1,
      with: {
        posts: true,
      },
      where: cursor
        ? (feeds, { gte, lte }) =>
            sortOrder === "asc"
              ? gte(feeds[orderBy], cursorTransform(cursor))
              : lte(feeds[orderBy], cursorTransform(cursor))
        : undefined,
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
