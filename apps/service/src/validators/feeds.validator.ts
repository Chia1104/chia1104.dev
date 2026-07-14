import * as z from "zod";

import {
  isQueryableEmbeddingModel,
  ollamaEmbeddingModelSchema,
  textEmbeddingModelSchema,
} from "@chia/ai/embeddings/utils";

export const searchFeedsSchema = z.object({
  keyword: z.string().trim().min(1).max(256),
  model: z
    .union([
      textEmbeddingModelSchema,
      ollamaEmbeddingModelSchema,
      z.literal("algolia"),
    ])
    .default("algolia")
    // vector search is only allowed for models the indexing workflow writes
    .refine(
      (model) => model === "algolia" || isQueryableEmbeddingModel(model),
      {
        message: "Embedding model is not indexed for search",
      }
    ),
});
