import { z } from "zod";

import { textEmbeddingModelSchema } from "@chia/ai/embeddings/openai";

export const searchFeedsSchema = z.object({
  keyword: z.string().optional(),
  model: textEmbeddingModelSchema.optional(),
});
