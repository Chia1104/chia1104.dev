import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { project } from "../../schema";
import { FeedOrderBy } from "../../types";

const internal_dateSchema = z.object({
  createdAt: z.union([z.string(), z.number()]).optional(),
  deletedAt: z.union([z.string(), z.number()]).optional(),
});

export const insertProjectSchema = z.object({
  ...createInsertSchema(project).omit({
    createdAt: true,
    deletedAt: true,
  }).shape,
  ...internal_dateSchema.shape,
});

export type InsertProjectDTO = z.infer<typeof insertProjectSchema>;

export const baseInfiniteSchema = z.object({
  limit: z.number().max(50).optional().default(10),
  cursor: z.union([z.string(), z.number()]).nullish(),
  orderBy: z
    .enum([FeedOrderBy.CreatedAt, FeedOrderBy.Id, FeedOrderBy.Slug])
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
