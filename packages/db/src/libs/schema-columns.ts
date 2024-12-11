import { sql } from "drizzle-orm";
import type { BuildExtraConfigColumns } from "drizzle-orm";
import {
  timestamp,
  text,
  integer,
  serial,
  index,
  uniqueIndex,
  boolean,
  vector,
} from "drizzle-orm/pg-core";

import { users } from "../schema";
import { feed_type, content_type } from "../schema/enums";
import { ContentType } from "../types";

export const baseFeedsColumns = {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  readTime: integer("readTime"),
  type: feed_type("type").notNull(),
  contentType: content_type("contentType").notNull().default(ContentType.Mdx),
  published: boolean("published").default(false),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
};

export const baseFeedsExtraConfig = (
  table: BuildExtraConfigColumns<"feed", typeof baseFeedsColumns, "pg">
) => {
  return [
    uniqueIndex("feed_id_index").on(table.id),
    uniqueIndex("feed_slug_index").on(table.slug),
    index("feed_title_index").on(table.title),
  ];
};

export const feedsWithEmbeddingColumns = {
  ...baseFeedsColumns,
  embedding: vector("embedding", { dimensions: 1536 }),
};

export const feedsWithEmbeddingExtraConfig = (
  table: BuildExtraConfigColumns<"feed", typeof feedsWithEmbeddingColumns, "pg">
) => {
  return [
    ...baseFeedsExtraConfig(table),
    index("feed_embedding_index").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ];
};
