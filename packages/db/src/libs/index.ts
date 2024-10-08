import dayjs from "dayjs";

import type { DB } from "../";

export const cursorTransform = (
  cursor: string | number,
  mode: "timestamp" | "default" = "default"
) => {
  try {
    if (mode === "timestamp") {
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

export const withDTO = <TDto = unknown, TResult = unknown>(
  fn: (db: DB, dto: TDto) => Promise<TResult>
) => {
  return async (db: DB, dto: TDto) => {
    return await fn(db, dto);
  };
};
