import type { z } from "zod";

import {
  insertFeedSchema,
  insertFeedContentSchema,
} from "@chia/db/validator/feeds";

export const createFeedSchema = insertFeedSchema
  .omit({ userId: true })
  .partial({ slug: true })
  .merge(
    insertFeedContentSchema("post")
      .omit({ feedId: true })
      .partial({ contentType: true })
  );

export type CreateFeedInput = z.infer<typeof createFeedSchema>;
