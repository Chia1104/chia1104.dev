import * as z from "zod";

// https://ollama.com/blog/embedding-models
export const OllamaEmbeddingModel = {
  "mxbai-embed-large": "mxbai-embed-large",
  "nomic-embed-text": "nomic-embed-text",
  "all-minilm": "all-minilm",
} as const;

export const ollamaEmbeddingModelSchema = z.enum(OllamaEmbeddingModel);

export type OllamaEmbeddingModel = z.infer<typeof ollamaEmbeddingModelSchema>;

export const isOllamaEmbeddingModel = (
  model?: unknown
): model is OllamaEmbeddingModel => {
  return z.enum(OllamaEmbeddingModel).safeParse(model).success;
};

// https://platform.openai.com/docs/guides/embeddings
export const TextEmbeddingModel = {
  "3-small": "text-embedding-3-small",
  "3-large": "text-embedding-3-large",
} as const;

export const textEmbeddingModelSchema = z.enum(TextEmbeddingModel);

export type TextEmbeddingModel = z.infer<typeof textEmbeddingModelSchema>;

export const isOpenAIEmbeddingModel = (
  model?: unknown
): model is TextEmbeddingModel => {
  return textEmbeddingModelSchema.safeParse(model).success;
};
