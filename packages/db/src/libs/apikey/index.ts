import { eq } from "drizzle-orm";
import type { SQLWrapper } from "drizzle-orm";

import dayjs from "@chia/utils/day";

import { cursorTransform, dateToTimestamp, withDTO } from "../";
import { schema } from "../..";
import { FeedOrderBy } from "../../types";
import type { InfiniteDTO } from "../validator/apikey";

export const setApiKeyProjectId = withDTO(
  async (
    db,
    dto: {
      apiKey: string;
      projectId: number;
    }
  ) => {
    await db.transaction(async (trx) => {
      await trx
        .update(schema.apikey)
        .set({
          projectId: dto.projectId,
        })
        .where(eq(schema.apikey.id, dto.apiKey));
    });
  }
);

export const getInfiniteApiKeysByProjectId = withDTO(
  async (
    db,
    {
      limit = 10,
      cursor,
      orderBy = FeedOrderBy.CreatedAt,
      sortOrder = "desc",
      whereAnd = [],
      projectId,
    }: InfiniteDTO & {
      projectId: number;
      whereAnd?: (SQLWrapper | undefined)[];
    }
  ) => {
    const parsedCursor = cursor
      ? cursorTransform(
          cursor,
          orderBy === FeedOrderBy.CreatedAt ? "timestamp" : "default"
        )
      : null;
    const items = await db.query.apikey.findMany({
      orderBy: (apikey, { asc, desc }) => [
        sortOrder === "asc" ? asc(apikey[orderBy]) : desc(apikey[orderBy]),
      ],
      limit: limit + 1,
      where: parsedCursor
        ? (apikey, { gte, lte, eq, and }) =>
            and(
              sortOrder === "asc"
                ? gte(apikey[orderBy], dayjs(parsedCursor).toISOString())
                : lte(apikey[orderBy], dayjs(parsedCursor).toISOString()),
              eq(apikey.projectId, projectId),
              ...whereAnd
            )
        : (apikey, { eq, and }) =>
            and(eq(apikey.projectId, projectId), ...whereAnd),
    });
    let nextCursor: ReturnType<typeof cursorTransform> | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor =
        orderBy === FeedOrderBy.CreatedAt
          ? dateToTimestamp(nextItem?.[orderBy] as dayjs.ConfigType)
          : nextItem?.[orderBy];
    }
    // const serializedItems = items.map((item) => ({
    //   ...item,
    //   createdAt: dayjs(item.createdAt).toISOString(),
    //   updatedAt: dayjs(item.updatedAt).toISOString(),
    //   expiresAt: dayjs(item.expiresAt).toISOString(),
    //   lastRefillAt: dayjs(item.lastRefillAt).toISOString(),
    //   lastRequest: dayjs(item.lastRequest).toISOString(),
    // }));
    return {
      items: items,
      nextCursor,
    };
  }
);
