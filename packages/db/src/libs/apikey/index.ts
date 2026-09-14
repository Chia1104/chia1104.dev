import type { SQLWrapper } from "drizzle-orm";

import { FeedOrderBy } from "../../types";
import {
  keysetCursorValue,
  keysetWhere,
  sliceKeysetPage,
  withDTO,
} from "../index.ts";
import type { InfiniteDTO } from "../validator/apikey";

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
    const rawFilters = whereAnd.filter(Boolean).map((condition) => ({
      RAW: condition,
    }));

    const rawItems = await db.query.apikey.findMany({
      orderBy: (key, { asc, desc }) => {
        const order = sortOrder === "asc" ? asc : desc;
        return [order(key[orderBy]), order(key.id)];
      },
      limit: limit + 1,
      extras: {
        cursorAt: (key) => keysetCursorValue(key[orderBy]),
      },
      where: {
        AND: cursor
          ? [
              {
                RAW: (key) =>
                  keysetWhere(key[orderBy], key.id, cursor, sortOrder),
              },
              ...rawFilters,
            ]
          : rawFilters,
      },
    });

    const { items, nextCursor } = sliceKeysetPage(rawItems, limit);

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
