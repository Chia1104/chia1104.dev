import { env, EmbeddingProviderId } from "../env.ts";
import { isOllamaEnabled } from "../ollama/utils.ts";

import { ollamaEmbeddings } from "./ollama.ts";
import {
  EMBEDDING_DIMENSIONS,
  OLLAMA_EMBEDDING_DIMENSIONS,
  OllamaEmbeddingModel,
} from "./utils.ts";
import type { EmbeddingTask } from "./utils.ts";

/**
 * The seam for swapping embedding models.
 *
 * `id` is folded into the index key, so switching providers invalidates
 * stored vectors instead of silently comparing across models.
 *
 * `task` is required: most models worth trying next are asymmetric, and a
 * query embedded with the document prefix silently degrades retrieval.
 * Symmetric models ignore it.
 */
export interface EmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;
  embed(texts: string[], task: EmbeddingTask): Promise<number[][]>;
}

export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const OLLAMA_EMBEDDING_MODEL = OllamaEmbeddingModel["nomic-embed-text"];

export interface OpenAIProviderOptions {
  /** the workflow runtime's instrumented fetch */
  fetch?: (
    input: string | URL | Request,
    init?: RequestInit
  ) => Promise<Response>;
}

/**
 * `./openai.ts` is imported inside `embed`, not at module scope: resolving a
 * provider is on the boot path of everything that indexes, but `@ai-sdk/openai`
 * and `ai` are only needed once vectors are requested.
 */
export const openAIEmbeddingProvider = (
  options: OpenAIProviderOptions = {}
): EmbeddingProvider => ({
  id: OPENAI_EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
  // text-embedding-3-* are symmetric; the task carries no prefix here
  embed: async (texts, _task) => {
    if (!env.EMBEDDING_API_KEY) {
      throw new Error(
        "EMBEDDING_API_KEY is not set; the OpenAI embedding provider needs it."
      );
    }
    return await (
      await import("./openai.ts")
    ).generateEmbeddings(texts, {
      model: OPENAI_EMBEDDING_MODEL,
      apiKey: env.EMBEDDING_API_KEY,
      fetch: options.fetch,
    });
  },
});

/**
 * Local models. Each reports its native width rather than the column's;
 * none can be asked for 1536 (see `OLLAMA_EMBEDDING_DIMENSIONS`).
 * `assertColumnWidth` turns a mismatch into a startup error instead of a
 * failed insert.
 */
export const ollamaEmbeddingProvider = (
  model: OllamaEmbeddingModel = OLLAMA_EMBEDDING_MODEL
): EmbeddingProvider => ({
  id: model,
  dimensions: OLLAMA_EMBEDDING_DIMENSIONS[model],
  embed: async (texts, task) => {
    if (!(await isOllamaEnabled(model))) {
      throw new Error(`Ollama model "${model}" is unavailable`);
    }
    return await ollamaEmbeddings(texts, model, task);
  },
});

/**
 * Rejects a provider whose vectors do not fit the column here rather than
 * at insert time, where the error names a Postgres column instead of the
 * setting that caused it. Switching to a narrower model is a schema change
 * (`EMBEDDING_DIMENSIONS` plus `resource_embedding.embedding`) then a reindex.
 */
const assertColumnWidth = (provider: EmbeddingProvider): EmbeddingProvider => {
  if (provider.dimensions !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding provider "${provider.id}" produces ${provider.dimensions}-dimension ` +
        `vectors, but the resource_embedding.embedding column is ${EMBEDDING_DIMENSIONS}. ` +
        `Change EMBEDDING_DIMENSIONS and the column together, then reindex.`
    );
  }
  return provider;
};

export const resolveEmbeddingProvider = (
  options: OpenAIProviderOptions = {}
): EmbeddingProvider =>
  assertColumnWidth(
    env.EMBEDDING_PROVIDER === EmbeddingProviderId.Ollama
      ? ollamaEmbeddingProvider()
      : openAIEmbeddingProvider(options)
  );
