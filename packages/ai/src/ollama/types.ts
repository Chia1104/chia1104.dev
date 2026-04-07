import { OllamaEmbeddingModel } from "../embeddings/utils.ts";

export const OllamaModel = {
  ...OllamaEmbeddingModel,
};

export type OllamaModel = (typeof OllamaModel)[keyof typeof OllamaModel];
