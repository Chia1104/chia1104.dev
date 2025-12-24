import { sql } from "drizzle-orm";
import { timestamp } from "drizzle-orm/pg-core";

/**
 * 共用的時間戳記欄位
 * 包含 created_at 和 updated_at
 */
export const timestamps = {
  createdAt: timestamp("created_at", { mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdate(() => new Date()),
};

/**
 * 可選的時間戳記欄位
 */
export const optionalTimestamps = {
  createdAt: timestamp("created_at", { mode: "date" }).default(
    sql`CURRENT_TIMESTAMP`
  ),
  updatedAt: timestamp("updated_at", { mode: "date" }).default(
    sql`CURRENT_TIMESTAMP`
  ),
};

/**
 * 軟刪除欄位
 */
export const softDelete = {
  deletedAt: timestamp("deleted_at", { mode: "date" }),
};
