import { ollama } from "../ollama/index.ts";

import { guardEmbeddingInput, guardEmbeddingInputs } from "./tokenizer.ts";
import { EMBEDDING_MAX_TOKENS, OLLAMA_EMBEDDING_MAX_TOKENS } from "./utils.ts";
import type { EmbeddingTask, OllamaEmbeddingModel } from "./utils.ts";

/**
 * Asymmetric models need task-specific prefixes or retrieval degrades.
 * See https://huggingface.co/nomic-ai/nomic-embed-text-v1.5 and
 * https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1.
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
 * Prefix is prepended after the guard, so its cost comes out of the budget
 * or the prefixed input overshoots the model limit. Longest prefix above is
 * well under this.
 */
const TASK_PREFIX_TOKEN_RESERVE = 32;

/** Per-model budget, never above the shared ceiling. */
const inputBudget = (model: OllamaEmbeddingModel): number =>
  Math.max(
    1,
    Math.min(EMBEDDING_MAX_TOKENS, OLLAMA_EMBEDDING_MAX_TOKENS[model]) -
      TASK_PREFIX_TOKEN_RESERVE
  );

/**
 * cl100k_base is not these models' tokenizer, so the count is approximate
 * and errs toward truncating more.
 *
 * No `dimensions` is requested: only `nomic-embed-text` would honour it, and
 * the caller must get the model's native width (see
 * `OLLAMA_EMBEDDING_DIMENSIONS`).
 */
export const ollamaEmbedding = async (
  input: string,
  model: OllamaEmbeddingModel,
  task: EmbeddingTask = "search_query"
) => {
  const { text } = await guardEmbeddingInput(
    input,
    { model },
    inputBudget(model)
  );
  const [embedding] = (
    await ollama.embed({
      model,
      input: withTaskPrefix(text, model, task),
    })
  ).embeddings;
  return embedding;
};

/** One Ollama call for a document and all of its chunks. */
export const ollamaEmbeddings = async (
  inputs: string[],
  model: OllamaEmbeddingModel,
  task: EmbeddingTask = "search_document"
): Promise<number[][]> => {
  if (inputs.length === 0) {
    return [];
  }
  const guarded = await guardEmbeddingInputs(
    inputs,
    { model },
    inputBudget(model)
  );
  const { embeddings } = await ollama.embed({
    model,
    input: guarded.map(({ text }) => withTaskPrefix(text, model, task)),
  });
  return embeddings;
};
