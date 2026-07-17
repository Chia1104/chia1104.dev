import { ollama } from "../ollama/index.ts";

import type { EmbeddingTask, OllamaEmbeddingModel } from "./utils.ts";
import { truncateForEmbedding } from "./utils.ts";

/**
 * Asymmetric models need task-specific prefixes, otherwise retrieval quality
 * degrades significantly. See https://huggingface.co/nomic-ai/nomic-embed-text-v1.5
 * and https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1.
 */
const withTaskPrefix = (
  input: string,
  model: OllamaEmbeddingModel,
  task: EmbeddingTask
) => {
  switch (model) {
    case "nomic-embed-text":
      return `${task}: ${input}`;
    case "mxbai-embed-large":
      return task === "search_query"
        ? `Represent this sentence for searching relevant passages: ${input}`
        : input;
    default:
      return input;
  }
};

export const ollamaEmbedding = async (
  input: string,
  model: OllamaEmbeddingModel,
  task: EmbeddingTask = "search_query"
) => {
  const [embedding] = (
    await ollama.embed({
      model,
      input: withTaskPrefix(truncateForEmbedding(input), model, task),
      dimensions: 512,
    })
  ).embeddings;
  return embedding;
};

/** Batch variant — one Ollama call for a document and all of its chunks. */
export const ollamaEmbeddings = async (
  inputs: string[],
  model: OllamaEmbeddingModel,
  task: EmbeddingTask = "search_document"
): Promise<number[][]> => {
  if (inputs.length === 0) {
    return [];
  }
  const { embeddings } = await ollama.embed({
    model,
    input: inputs.map((input) =>
      withTaskPrefix(truncateForEmbedding(input), model, task)
    ),
    dimensions: 512,
  });
  return embeddings;
};
