import { z } from "zod/v4";

import { FeedOrderBy } from "@chia/db/types";
import {
  baseInfiniteSchema,
  insertFeedMetaSchema,
  updateFeedSchema,
} from "@chia/db/validator/feeds";
import { numericStringSchema } from "@chia/utils";

export const getFeedsWithMetaSchema = z
  .object({
    limit: numericStringSchema.optional().default(20),
    nextCursor: numericStringSchema.optional(),
    withContent: z.string().optional().default("false"),
    published: z.string().optional().default("false"),
    orderBy: z
      .enum([FeedOrderBy.CreatedAt, FeedOrderBy.UpdatedAt, FeedOrderBy.Id])
      .optional()
      .default(FeedOrderBy.CreatedAt),
    ...baseInfiniteSchema.omit({
      cursor: true,
      limit: true,
      withContent: true,
      orderBy: true,
    }).shape,
  })
  .or(
    z.object({
      limit: numericStringSchema.optional().default(20),
      nextCursor: z.string().optional(),
      withContent: z.string().optional().default("false"),
      published: z.string().optional().default("false"),
      orderBy: z
        .enum([FeedOrderBy.Slug, FeedOrderBy.Title])
        .optional()
        .default(FeedOrderBy.Slug),
      ...baseInfiniteSchema.omit({
        cursor: true,
        limit: true,
        withContent: true,
        orderBy: true,
      }).shape,
    })
  );

export const insertFeedMetaRequestSchema = insertFeedMetaSchema;

export const updateFeedRequestSchema = updateFeedSchema;
