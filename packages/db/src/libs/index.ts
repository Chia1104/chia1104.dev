import dayjs from "@chia/utils/day";

import type { DB } from "../";

export const cursorTransform = (
  cursor: string | number,
  mode: "date" | "default" = "default"
) => {
  try {
    if (mode === "date") {
      return dayjs(cursor).toDate();
    }
    return cursor;
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const dateToTimestamp = (date: dayjs.ConfigType) => {
  return dayjs(date).valueOf();
};

export type CursorPaginationOrderBy = string;

export function parseCursorForOrder<T extends CursorPaginationOrderBy>(
  cursor: string | number | null | undefined,
  orderBy: T,
  dateOrderByValues: ReadonlySet<T> | ReadonlyArray<T>
): ReturnType<typeof cursorTransform> {
  if (cursor == null) return null;
  const isDateOrder = Array.isArray(dateOrderByValues)
    ? dateOrderByValues.includes(orderBy as string)
    : (dateOrderByValues as ReadonlySet<string>).has(orderBy as string);
  return cursorTransform(cursor, isDateOrder ? "date" : "default");
}

export function buildCursorWhere<T extends CursorPaginationOrderBy>(
  orderBy: T,
  parsedCursor: ReturnType<typeof cursorTransform>,
  sortOrder: "asc" | "desc"
) {
  if (parsedCursor == null) return undefined;
  const op = sortOrder === "asc" ? "gte" : "lte";
  return {
    [orderBy]: { [op]: parsedCursor },
  };
}

export function sliceNextCursor<T extends Record<string, unknown>>(
  items: T[],
  limit: number,
  orderBy: keyof T & string,
  dateOrderByValues: ReadonlySet<string> | ReadonlyArray<string>
) {
  let nextCursor: string | number | null = null;
  if (items.length > limit) {
    const nextItem = items.pop();
    const raw = nextItem?.[orderBy];
    const isDateOrder = Array.isArray(dateOrderByValues)
      ? dateOrderByValues.includes(orderBy)
      : (dateOrderByValues as ReadonlySet<string>).has(orderBy);
    nextCursor =
      isDateOrder && raw != null
        ? dateToTimestamp(raw as dayjs.ConfigType)
        : ((raw as string | number | null) ?? null);
  }
  return { items, nextCursor };
}

export const withDTO = <TDto, TDB extends DB, TResult>(
  fn: (db: TDB, dto: TDto) => Promise<TResult>
) => {
  return async (db: TDB, dto: TDto) => {
    return await fn(db, dto);
  };
};
