import { z } from "zod";

import { ollama } from "../ollama";

// https://ollama.com/blog/embedding-models
export const OllamaEmbeddingModel = {
  "mxbai-embed-large": "mxbai-embed-large",
  "nomic-embed-text": "nomic-embed-text",
  "all-minilm": "all-minilm",
} as const;

export const ollamaEmbeddingModelSchema = z.nativeEnum(OllamaEmbeddingModel);

export type OllamaEmbeddingModel = z.infer<typeof ollamaEmbeddingModelSchema>;

export const isOllamaEmbeddingModel = (
  model?: unknown
): model is OllamaEmbeddingModel => {
  return z.nativeEnum(OllamaEmbeddingModel).safeParse(model).success;
};

export const ollamaEmbedding = async (
  input: string,
  model: OllamaEmbeddingModel
) => {
  const { embedding } = await ollama.embeddings({
    model,
    prompt: input,
  });
  return embedding;
};
