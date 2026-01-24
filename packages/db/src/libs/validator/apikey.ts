import { createInsertSchema } from "drizzle-zod";
import * as z from "zod";

import { apikey } from "../../schemas";
import { FeedOrderBy } from "../../types";

import {
  dateSchema,
  baseInfiniteSchema as baseInfiniteSchemaShared,
} from "./shared";

export const insertApiKeySchema = z.object({
  ...createInsertSchema(apikey).omit({
    createdAt: true,
    updatedAt: true,
    expiresAt: true,
  }).shape,
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
  expiresAt: dateSchema.optional(),
});

export type InsertApiKeyDTO = z.infer<typeof insertApiKeySchema>;

export const baseInfiniteSchema = z.object({
  ...baseInfiniteSchemaShared.shape,
  orderBy: z
    .enum([FeedOrderBy.CreatedAt, FeedOrderBy.Id])
    .optional()
    .default(FeedOrderBy.CreatedAt),
});

export const infiniteSchema = baseInfiniteSchema.optional().default({
  limit: 10,
  cursor: null,
  orderBy: FeedOrderBy.CreatedAt,
  sortOrder: "desc",
});

export type InfiniteDTO = z.infer<typeof infiniteSchema>;
