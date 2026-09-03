import type { SQLWrapper } from "drizzle-orm";

import { FeedOrderBy } from "../../types";
import {
  buildCursorWhere,
  parseCursorForOrder,
  sliceNextCursor,
  withDTO,
} from "../index.ts";
import type { InfiniteDTO } from "../validator/apikey";

const APIKEY_DATE_ORDER_BY = new Set([FeedOrderBy.CreatedAt]);

const toISO = (date: Date | null) => date?.toISOString() ?? null;

/** better-auth stores permissions as JSON text; its own endpoints hand back the object. */
const parsePermissions = (raw: string | null) => {
  if (!raw) return null;
  // SAFETY: better-auth writes this column with JSON.stringify of a permissions record.
  return JSON.parse(raw) as Record<string, string[]>;
};

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
    const cursorFilter = buildCursorWhere(orderBy, parsedCursor, sortOrder);
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
      permissions: parsePermissions(item.permissions),
      updatedAt: item.updatedAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
      lastRefillAt: toISO(item.lastRefillAt),
      expiresAt: toISO(item.expiresAt),
      lastRequest: toISO(item.lastRequest),
    }));
    return {
      items: serializedItems,
      nextCursor,
    };
  }
);
