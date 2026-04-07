import { ollama } from "../ollama/index.ts";

import type { OllamaEmbeddingModel } from "./utils.ts";

export const ollamaEmbedding = async (
  input: string,
  model: OllamaEmbeddingModel
) => {
  const [embedding] = (
    await ollama.embed({
      model,
      input,
      dimensions: 512,
    })
  ).embeddings;
  return embedding;
};
