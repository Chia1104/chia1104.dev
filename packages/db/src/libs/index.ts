import type { Column, SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

import type { DB } from "../client.ts";

/**
 * Epoch ms, numeric string, or ISO. `new Date("1693…")` is invalid, so numeric
 * strings are parsed as milliseconds first.
 */
export const parseInstant = (value: string | number): Date => {
  const wire = String(value);
  const epoch = Number(wire);
  if (wire !== "" && Number.isFinite(epoch)) return new Date(epoch);
  return new Date(wire);
};

/**
 * Keyset cursor `<order column as Postgres text>|<id>`. Text keeps the microseconds a JS `Date`
 * would drop, and `id` breaks ties, so a page never repeats or skips a row.
 */
export const keysetCursorValue = (column: Column) =>
  sql<string>`${column}::text`;

/** Rows from the cursor's row onwards; the cursor names the first row of the page. */
export const keysetWhere = (
  column: Column,
  id: Column,
  cursor: string,
  sortOrder: "asc" | "desc"
): SQL => {
  const separator = cursor.lastIndexOf("|");
  // Parameters stay untyped so Postgres resolves each one against its column in the row comparison.
  const boundary = sql`(${cursor.slice(0, separator)}, ${cursor.slice(separator + 1)})`;
  return sortOrder === "asc"
    ? sql`(${column}, ${id}) >= ${boundary}`
    : sql`(${column}, ${id}) <= ${boundary}`;
};

/** Splits a `limit + 1` result into the page and the cursor of the probe row. */
export const sliceKeysetPage = <
  TRow extends { cursorAt: string; id: string | number },
>(
  rows: TRow[],
  limit: number
) => {
  const next = rows[limit];
  return {
    items: rows.slice(0, limit).map(({ cursorAt: _cursorAt, ...item }) => item),
    nextCursor: next ? `${next.cursorAt}|${next.id}` : null,
  };
};

export const withDTO = <TDto, TDB extends DB, TResult>(
  fn: (db: TDB, dto: TDto) => Promise<TResult>
) => {
  return async (db: TDB, dto: TDto) => {
    return await fn(db, dto);
  };
};
