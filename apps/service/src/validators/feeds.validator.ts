import { z } from "zod";

import { baseInfiniteSchema } from "@chia/db";
import { FeedOrderBy } from "@chia/db/types";
import { numericStringSchema } from "@chia/utils";

export const getFeedsWithMetaSchema = z
  .object({
    limit: numericStringSchema.optional().default("20"),
    nextCursor: numericStringSchema.optional(),
    withContent: z.string().optional().default("false"),
    orderBy: z
      .enum([FeedOrderBy.CreatedAt, FeedOrderBy.UpdatedAt, FeedOrderBy.Id])
      .optional()
      .default(FeedOrderBy.CreatedAt),
  })
  .merge(
    baseInfiniteSchema.omit({
      cursor: true,
      limit: true,
      withContent: true,
      orderBy: true,
    })
  )
  .or(
    z
      .object({
        limit: numericStringSchema.optional().default("20"),
        nextCursor: z.string().optional(),
        withContent: z.string().optional().default("false"),
        orderBy: z
          .enum([FeedOrderBy.Slug, FeedOrderBy.Title])
          .optional()
          .default(FeedOrderBy.Slug),
      })
      .merge(
        baseInfiniteSchema.omit({
          cursor: true,
          limit: true,
          withContent: true,
          orderBy: true,
        })
      )
  );

export type GetFeedsWithMetaDTO = z.infer<typeof getFeedsWithMetaSchema>;
