import * as z from "zod";

import { FeedOrderBy } from "../../types";

import { baseInfiniteSchema as baseInfiniteSchemaShared } from "./shared";

export const baseInfiniteSchema = baseInfiniteSchemaShared.extend({
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
