import { createInsertSchema } from "drizzle-orm/zod";
import * as z from "zod";

import { user } from "../../schemas/schema.ts";
import { FeedOrderBy } from "../../types";

import { baseInfiniteSchema as baseInfiniteSchemaShared } from "./shared";

export const insertUserSchema = createInsertSchema(user)
  .omit({
    id: true,
    emailVerified: true,
  })
  .extend({
    id: z.uuid(),
  });

export type InsertUserDTO = z.infer<typeof insertUserSchema>;

export const baseInfiniteSchema = baseInfiniteSchemaShared.extend({
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
