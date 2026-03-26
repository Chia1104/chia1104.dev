import { createInsertSchema } from "drizzle-orm/zod";
import * as z from "zod";

import { user } from "../../schemas";
import { FeedOrderBy } from "../../types";

import { baseInfiniteSchema as baseInfiniteSchemaShared } from "./shared";

export const insertUserSchema = z.object({
  ...createInsertSchema(user).omit({
    id: true,
    emailVerified: true,
  }).shape,
  id: z.uuid(),
});

export type InsertUserDTO = z.infer<typeof insertUserSchema>;

export const baseInfiniteSchema = z.object({
  ...baseInfiniteSchemaShared.shape,
  orderBy: z
    .enum([FeedOrderBy.CreatedAt, FeedOrderBy.UpdatedAt])
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
