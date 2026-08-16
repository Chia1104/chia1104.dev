import { isOllamaEnabled } from "../ollama/utils.ts";

import { ollamaEmbeddings } from "./ollama.ts";
import {
  EMBEDDING_DIMENSIONS,
  OLLAMA_EMBEDDING_DIMENSIONS,
  OllamaEmbeddingModel,
} from "./utils.ts";
import type { EmbeddingTask } from "./utils.ts";

/**
 * The one seam for swapping embedding models.
 *
 * There used to be a registry of five models with `indexed` / `canonical` /
 * `queryEnabled` flags, two vector columns, and an `isOllama` branch in six
 * call sites — to serve a system that in practice queried exactly one model.
 * Everything a caller needs is now behind `embed()`, chosen once here.
 *
 * `id` is folded into the index key, so switching providers invalidates every
 * stored vector automatically instead of silently comparing across models.
 *
 * `task` is required, not defaulted: most embedding models worth trying next
 * (nomic, mxbai, e5, voyage) are asymmetric — a query embedded with the
 * document prefix silently degrades retrieval — so every caller has to state
 * which side of the search it is on. Symmetric models ignore it.
 */
export interface EmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;
  embed(texts: string[], task: EmbeddingTask): Promise<number[][]>;
}

export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const OLLAMA_EMBEDDING_MODEL = OllamaEmbeddingModel["nomic-embed-text"];

export interface OpenAIProviderOptions {
  apiKey?: string;
  /** the workflow runtime's instrumented fetch */
  fetch?: (
    input: string | URL | Request,
    init?: RequestInit
  ) => Promise<Response>;
}

/**
 * `./openai.ts` is imported inside `embed` rather than at module scope: resolving a
 * provider is part of the boot path of everything that indexes, but `@ai-sdk/openai`
 * and `ai` are only needed once vectors are actually requested.
 */
export const openAIEmbeddingProvider = (
  options: OpenAIProviderOptions = {}
): EmbeddingProvider => ({
  id: OPENAI_EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
  // text-embedding-3-* are symmetric; the task carries no prefix here
  embed: async (texts, _task) =>
    await (
      await import("./openai.ts")
    ).generateEmbeddings(texts, {
      model: OPENAI_EMBEDDING_MODEL,
      apiKey: options.apiKey,
      fetch: options.fetch,
    }),
});

/**
 * Local models for experimentation. Each reports its *native* width rather than
 * the column's, because none of them can be asked for 1536 — see
 * `OLLAMA_EMBEDDING_DIMENSIONS`. `assertColumnWidth` is what turns that into a
 * startup error instead of a failed insert.
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
 * One vector column, one width. A provider whose vectors do not fit it is
 * rejected here rather than at insert time, where the error names a Postgres
 * column and not the setting that caused it.
 *
 * Switching to a narrower model is a schema change (`EMBEDDING_DIMENSIONS` plus
 * the `resource_embedding.embedding` column) followed by a reindex.
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

/**
 * Resolves the provider for this process. `EMBEDDING_PROVIDER=ollama` opts into
 * the local model; anything else uses OpenAI.
 */
export const resolveEmbeddingProvider = (
  options: OpenAIProviderOptions = {}
): EmbeddingProvider =>
  assertColumnWidth(
    process.env.EMBEDDING_PROVIDER === "ollama"
      ? ollamaEmbeddingProvider()
      : openAIEmbeddingProvider(options)
  );
