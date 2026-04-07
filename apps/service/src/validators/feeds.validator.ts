import * as z from "zod";

import { ollamaEmbeddingModelSchema } from "@chia/ai/embeddings/utils";
import { textEmbeddingModelSchema } from "@chia/ai/embeddings/utils";

export const searchFeedsSchema = z.object({
  keyword: z.string().optional(),
  model: z
    .union([
      textEmbeddingModelSchema,
      ollamaEmbeddingModelSchema,
      z.literal("algolia"),
    ])
    .default("algolia"),
});
