import type { SQLWrapper } from "drizzle-orm";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { EmptyFilter } from "drizzle-orm/relations";

import type { DB } from "../../client.ts";
import { apikey } from "../../schemas/schema.ts";
import { FeedOrderBy } from "../../types";
import {
  keysetCursorValue,
  keysetWhere,
  sliceKeysetPage,
  withDTO,
} from "../index.ts";
import type { InfiniteDTO } from "../validator/apikey";

const toISO = (date: Date | null) => date?.toISOString() ?? null;

/** Every column but the hash, which never leaves the verifier. */
const viewColumns = {
  id: apikey.id,
  name: apikey.name,
  start: apikey.start,
  userId: apikey.userId,
  scopes: apikey.scopes,
  enabled: apikey.enabled,
  expiresAt: apikey.expiresAt,
  lastUsedAt: apikey.lastUsedAt,
  createdAt: apikey.createdAt,
  updatedAt: apikey.updatedAt,
};

interface ApiKeyRow {
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const serializeApiKey = <T extends ApiKeyRow>(row: T) => ({
  ...row,
  expiresAt: toISO(row.expiresAt),
  lastUsedAt: toISO(row.lastUsedAt),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

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
      columns: { keyHash: false },
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
          : rawFilters.length > 0
            ? rawFilters
            : EmptyFilter,
      },
    });

    const { items, nextCursor } = sliceKeysetPage(rawItems, limit);

    return {
      items: items.map(serializeApiKey),
      nextCursor,
    };
  }
);

export const createApiKey = async (
  db: DB,
  input: {
    userId: string;
    name: string | null;
    scopes: string[];
    keyHash: string;
    start: string;
  }
) => {
  const [row] = await db.insert(apikey).values(input).returning(viewColumns);
  if (!row) throw new Error("API key insert returned no row");
  return serializeApiKey(row);
};

/** Only the owner's key matches; `null` is a missing or foreign key. */
export const updateApiKey = async (
  db: DB,
  input: {
    id: string;
    userId: string;
    name?: string;
    scopes?: string[];
    enabled?: boolean;
  }
) => {
  const [row] = await db
    .update(apikey)
    .set({ name: input.name, scopes: input.scopes, enabled: input.enabled })
    .where(and(eq(apikey.id, input.id), eq(apikey.userId, input.userId)))
    .returning(viewColumns);
  return row ? serializeApiKey(row) : null;
};

/** Returns whether the owner had such a key. */
export const deleteApiKey = async (
  db: DB,
  input: { id: string; userId: string }
) => {
  const rows = await db
    .delete(apikey)
    .where(and(eq(apikey.id, input.id), eq(apikey.userId, input.userId)))
    .returning({ id: apikey.id });
  return rows.length > 0;
};

/** The key stored under `keyHash`, enabled or not, for the verifier to judge. */
export const findApiKeyByHash = async (db: DB, keyHash: string) => {
  const [row] = await db
    .select({
      id: apikey.id,
      userId: apikey.userId,
      scopes: apikey.scopes,
      enabled: apikey.enabled,
      expiresAt: apikey.expiresAt,
    })
    .from(apikey)
    .where(eq(apikey.keyHash, keyHash))
    .limit(1);
  return row ?? null;
};

/** At most one write a minute per key, so a busy key does not write on every request. */
const LAST_USED_RESOLUTION_MS = 60_000;

export const touchApiKey = async (db: DB, id: string) => {
  await db
    .update(apikey)
    .set({ lastUsedAt: new Date() })
    .where(
      and(
        eq(apikey.id, id),
        or(
          isNull(apikey.lastUsedAt),
          lt(apikey.lastUsedAt, new Date(Date.now() - LAST_USED_RESOLUTION_MS))
        )
      )
    );
};
