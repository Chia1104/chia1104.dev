import type { SQLWrapper } from "drizzle-orm";

import dayjs from "@chia/utils/day";

import { FeedOrderBy } from "../../types";
import { parseCursorForOrder, sliceNextCursor, withDTO } from "../index.ts";
import type { InfiniteDTO } from "../validator/apikey";

const APIKEY_DATE_ORDER_BY = new Set([FeedOrderBy.CreatedAt]);

export const getInfiniteApiKeys = withDTO(
  async (
    db,
    {
      limit = 10,
      cursor,
      orderBy = FeedOrderBy.CreatedAt,
      sortOrder = "desc",
      whereAnd = [],
    }: Partial<InfiniteDTO> & {
      whereAnd?: SQLWrapper[];
    }
  ) => {
    const parsedCursor = parseCursorForOrder(
      cursor ?? null,
      orderBy,
      APIKEY_DATE_ORDER_BY
    );
    const cursorValue = parsedCursor ? dayjs(parsedCursor).toISOString() : null;
    const cursorFilter = cursorValue
      ? {
          [orderBy]: {
            [sortOrder === "asc" ? "gte" : "lte"]: cursorValue,
          },
        }
      : null;
    const rawFilters = whereAnd.filter(Boolean).map((condition) => ({
      RAW: condition,
    }));

    const rawItems = await db.query.apikey.findMany({
      orderBy: (apikey, { asc, desc }) => [
        sortOrder === "asc" ? asc(apikey[orderBy]) : desc(apikey[orderBy]),
      ],
      limit: limit + 1,
      where: cursorFilter
        ? { AND: [cursorFilter, ...rawFilters] }
        : rawFilters.length
          ? { AND: rawFilters }
          : {},
    });

    const { items, nextCursor } = sliceNextCursor(
      rawItems,
      limit,
      orderBy,
      APIKEY_DATE_ORDER_BY
    );

    const serializedItems = items.map((item) => ({
      ...item,
      updatedAt: dayjs(item.updatedAt).toISOString(),
      createdAt: dayjs(item.createdAt).toISOString(),
      lastRefillAt: item.lastRefillAt
        ? dayjs(item.lastRefillAt).toISOString()
        : null,
      expiresAt: item.expiresAt ? dayjs(item.expiresAt).toISOString() : null,
      lastRequest: item.lastRequest
        ? dayjs(item.lastRequest).toISOString()
        : null,
    }));
    return {
      items: serializedItems,
      nextCursor,
    };
  }
);
