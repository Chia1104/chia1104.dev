import { z } from "zod";

import { baseInfiniteSchema } from "@chia/db";
import { numericStringSchema } from "@chia/utils";

export const getFeedsWithMetaSchema = z
  .object({
    limit: numericStringSchema.optional().default("20"),
    nextCursor: z.union([numericStringSchema, z.string()]).optional(),
    withContent: z.string().optional().default("false"),
  })
  .merge(
    baseInfiniteSchema.omit({ cursor: true, limit: true, withContent: true })
  );

export type GetFeedsWithMetaDTO = z.infer<typeof getFeedsWithMetaSchema>;
