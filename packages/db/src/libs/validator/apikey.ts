import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { apikey } from "../../schema/apikey";
import { FeedOrderBy } from "../../types";

const internal_dateSchema = z.object({
  createdAt: z.union([z.string(), z.number()]).optional(),
  updatedAt: z.union([z.string(), z.number()]).optional(),
  expiresAt: z.union([z.string(), z.number()]).optional(),
});

export const insertApiKeySchema = createInsertSchema(apikey)
  .omit({
    createdAt: true,
    updatedAt: true,
    expiresAt: true,
  })
  .merge(internal_dateSchema);

export type InsertApiKeyDTO = z.infer<typeof insertApiKeySchema>;

export const baseInfiniteSchema = z.object({
  limit: z.number().max(50).optional().default(10),
  cursor: z.union([z.string(), z.number()]).nullish(),
  orderBy: z
    .enum([FeedOrderBy.CreatedAt, FeedOrderBy.Id])
    .optional()
    .default(FeedOrderBy.CreatedAt),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const infiniteSchema = baseInfiniteSchema.optional().default({
  limit: 10,
  cursor: null,
  orderBy: FeedOrderBy.CreatedAt,
  sortOrder: "desc",
});

export type InfiniteDTO = z.infer<typeof infiniteSchema>;
