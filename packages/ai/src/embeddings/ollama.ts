import { ollama } from "../ollama/index.ts";

import { guardEmbeddingInput, guardEmbeddingInputs } from "./tokenizer.ts";
import type { EmbeddingTask, OllamaEmbeddingModel } from "./utils.ts";

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

/**
 * cl100k_base is not these models' tokenizer, so the count is approximate —
 * but it errs on the side of truncating more, which is the safe direction.
 */
export const ollamaEmbedding = async (
  input: string,
  model: OllamaEmbeddingModel,
  task: EmbeddingTask = "search_query"
) => {
  const { text } = await guardEmbeddingInput(input, { model });
  const [embedding] = (
    await ollama.embed({
      model,
      input: withTaskPrefix(text, model, task),
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
  const guarded = await guardEmbeddingInputs(inputs, { model });
  const { embeddings } = await ollama.embed({
    model,
    input: guarded.map(({ text }) => withTaskPrefix(text, model, task)),
    dimensions: 512,
  });
  return embeddings;
};
