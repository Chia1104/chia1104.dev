import * as z from "zod";

import { ollamaEmbeddingModelSchema } from "@chia/ai/embeddings/ollama";
import { textEmbeddingModelSchema } from "@chia/ai/embeddings/openai";

export const searchFeedsSchema = z.object({
  keyword: z.string().optional(),
  model: z
    .union([textEmbeddingModelSchema, ollamaEmbeddingModelSchema])
    .optional(),
});
