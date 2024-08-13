import { z } from "zod";

import { baseInfiniteSchema } from "@chia/db";
import { numericStringSchema } from "@chia/utils";

export const getFeedsWithMetaSchema = z
  .object({
    limit: numericStringSchema.optional().default("20"),
    cursor: z.union([numericStringSchema, z.string()]).optional(),
  })
  .merge(baseInfiniteSchema.omit({ cursor: true, limit: true }));

export type GetFeedsWithMetaDTO = z.infer<typeof getFeedsWithMetaSchema>;
