import { OllamaEmbeddingModel } from "../embeddings/ollama";

export const OllamaModel = {
  ...OllamaEmbeddingModel,
};

export type OllamaModel = (typeof OllamaModel)[keyof typeof OllamaModel];
