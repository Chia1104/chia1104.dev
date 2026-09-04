import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const EmbeddingProviderId = {
  OpenAI: "openai",
  Ollama: "ollama",
} as const;

export type EmbeddingProviderId =
  (typeof EmbeddingProviderId)[keyof typeof EmbeddingProviderId];

export const env = createEnv({
  server: {
    EMBEDDING_PROVIDER: z
      .enum(EmbeddingProviderId)
      .optional()
      .default(EmbeddingProviderId.OpenAI),
    /** The embedding vendor's key. Separate from any chat key so the two rotate independently. */
    EMBEDDING_API_KEY: z.string().min(1).optional(),
    OLLAMA_BASE_URL: z.url().optional().default("http://localhost:11434"),
  },
  runtimeEnv: {
    EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,
    EMBEDDING_API_KEY: process.env.EMBEDDING_API_KEY,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
  },
  emptyStringAsUndefined: true,
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === "true" ||
    process.env.SKIP_ENV_VALIDATION === "1",
});
