import type { SQLWrapper } from "drizzle-orm";
import { eq } from "drizzle-orm";

import dayjs from "@chia/utils/day";

import { parseCursorForOrder, sliceNextCursor, withDTO } from "../";
import { schema } from "../..";
import { FeedOrderBy } from "../../types";
import type { InfiniteDTO } from "../validator/apikey";

const APIKEY_DATE_ORDER_BY = new Set([FeedOrderBy.CreatedAt]);

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
      where: {
        projectId,
        ...(cursorFilter ? { AND: [cursorFilter, ...rawFilters] } : {}),
        ...(!cursorFilter && rawFilters.length ? { AND: rawFilters } : {}),
      },
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

export const getInfiniteApiKeys = withDTO(
  async (
    db,
    {
      limit = 10,
      cursor,
      orderBy = FeedOrderBy.CreatedAt,
      sortOrder = "desc",
      whereAnd = [],
      withProject,
    }: Partial<InfiniteDTO> & {
      whereAnd?: SQLWrapper[];
      withProject?: boolean;
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
      where: {
        ...(cursorFilter ? { AND: [cursorFilter, ...rawFilters] } : {}),
        ...(!cursorFilter && rawFilters.length ? { AND: rawFilters } : {}),
      },
      with: withProject
        ? {
            project: true,
          }
        : undefined,
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
