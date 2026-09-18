import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const EmbeddingProviderId = {
  OpenAI: "openai",
  Ollama: "ollama",
} as const;

export type EmbeddingProviderId =
  (typeof EmbeddingProviderId)[keyof typeof EmbeddingProviderId];

export const RerankProviderId = {
  None: "none",
  Jev: "jev",
} as const;

export type RerankProviderId =
  (typeof RerankProviderId)[keyof typeof RerankProviderId];

export const env = createEnv({
  server: {
    EMBEDDING_PROVIDER: z
      .enum(EmbeddingProviderId)
      .optional()
      .default(EmbeddingProviderId.OpenAI),
    /** The embedding vendor's key. Separate from any chat key so the two rotate independently. */
    EMBEDDING_API_KEY: z.string().min(1).optional(),
    OLLAMA_BASE_URL: z.url().optional().default("http://localhost:11434"),
    /** Off by default: a reranker adds a vendor round trip to every agent search. */
    RERANK_PROVIDER: z
      .enum(RerankProviderId)
      .optional()
      .default(RerankProviderId.None),
    /** The rerank vendor's key. Separate from the chat gateway key so the two rotate independently. */
    RERANK_API_KEY: z.string().min(1).optional(),
  },
  runtimeEnv: {
    EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
    EMBEDDING_API_KEY: process.env.EMBEDDING_API_KEY,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
    RERANK_PROVIDER: process.env.RERANK_PROVIDER,
    RERANK_API_KEY: process.env.RERANK_API_KEY,
  },
  emptyStringAsUndefined: true,
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
