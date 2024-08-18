import { z } from "zod";

import {
  insertFeedSchema,
  insertFeedContentSchema,
} from "@chia/db/validator/feeds";

const dateSchema = z.object({
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export const createFeedSchema = insertFeedSchema
  .omit({ userId: true, createdAt: true, updatedAt: true })
  .partial({ slug: true })
  .merge(
    insertFeedContentSchema("post")
      .omit({ feedId: true })
      .partial({ contentType: true })
  )
  .merge(dateSchema);

export type CreateFeedInput = z.infer<typeof createFeedSchema>;

export const updateFeedSchema = insertFeedSchema
  .omit({ userId: true, createdAt: true, updatedAt: true })
  .partial()
  .merge(insertFeedContentSchema("post").partial({ contentType: true }))
  .merge(dateSchema);

export const deleteFeedSchema = z.object({
  feedId: z.number(),
});
