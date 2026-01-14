import { OllamaEmbeddingModel } from "../embeddings/ollama.ts";

export const OllamaModel = {
  ...OllamaEmbeddingModel,
};

export type OllamaModel = (typeof OllamaModel)[keyof typeof OllamaModel];
