import type { InferSelectModel } from "drizzle-orm";
import {
  bigserial,
  index,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { feeds } from "./contents.schema.ts";
import { locale } from "./enums.ts";
import { pgTable } from "./table.ts";

/**
 * One page a reader's browser reported. `visitor` hashes the address and user agent with a salt
 * that rotates daily, so views count per visitor within a day but never link across days or
 * back to a person.
 */
export const pageViews = pgTable(
  "page_view",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    /** The page's path without the locale prefix, e.g. `/posts/some-slug`. */
    path: text("path").notNull(),
    /** Set when `path` is a post or note page. */
    feedId: integer("feed_id").references(() => feeds.id, {
      onDelete: "set null",
    }),
    locale: locale("locale").notNull(),
    visitor: text("visitor").notNull(),
    /** Host of an external referrer; `null` for direct visits and in-site navigation. */
    referrerHost: text("referrer_host"),
    /** ISO country code Cloudflare resolved for the request. */
    country: text("country"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("page_view_created_at_idx").on(table.createdAt),
    index("page_view_feed_id_created_at_idx").on(table.feedId, table.createdAt),
    index("page_view_path_created_at_idx").on(table.path, table.createdAt),
  ]
);

export type PageView = InferSelectModel<typeof pageViews>;
