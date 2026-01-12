import { timestamp } from "drizzle-orm/pg-core";

/**
 * 共用的時間戳記欄位
 * 包含 created_at 和 updated_at
 */
export const timestamps = {
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

/**
 * 可選的時間戳記欄位
 */
export const optionalTimestamps = {
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow(),
};

/**
 * 軟刪除欄位
 */
export const softDelete = {
  deletedAt: timestamp("deleted_at", { mode: "date" }),
};
