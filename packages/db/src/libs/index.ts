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
  dateOrderByValues: ReadonlySet<T> | readonly T[]
): ReturnType<typeof cursorTransform> {
  if (cursor == null) return null;
  const isDateOrder = Array.isArray(dateOrderByValues)
    ? dateOrderByValues.includes(
        /* SAFETY: The producer contract guarantees this value satisfies string. */ orderBy as string
      )
    : /* SAFETY: The producer contract guarantees this value satisfies ReadonlySet<string>. */ (
        dateOrderByValues as ReadonlySet<string>
      ).has(
        /* SAFETY: The producer contract guarantees this value satisfies string. */ orderBy as string
      );
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

export function sliceNextCursor<T extends object>(
  items: T[],
  limit: number,
  orderBy: keyof T & string,
  dateOrderByValues: ReadonlySet<string> | readonly string[]
) {
  let nextCursor: string | number | null = null;
  if (items.length > limit) {
    const nextItem = items.pop();
    const raw = nextItem?.[orderBy];
    const isDateOrder = Array.isArray(dateOrderByValues)
      ? dateOrderByValues.includes(orderBy)
      : /* SAFETY: The producer contract guarantees this value satisfies ReadonlySet<string>. */ (
          dateOrderByValues as ReadonlySet<string>
        ).has(orderBy);
    // SAFETY: orderBy selects a cursor-compatible scalar column from the same row.
    nextCursor =
      isDateOrder && raw != null
        ? dateToTimestamp(
            /* SAFETY: The producer contract guarantees this value satisfies dayjs.ConfigType. */ raw as dayjs.ConfigType
          )
        : /* SAFETY: The producer contract guarantees this value satisfies string | number | null. */ ((raw as
            | string
            | number
            | null) ?? null);
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
