import { isOllamaEnabled } from "../ollama/utils.ts";

import { ollamaEmbeddings } from "./ollama.ts";
import { generateEmbeddings } from "./openai.ts";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_INDEX_VERSION,
  OllamaEmbeddingModel,
} from "./utils.ts";

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
 */
export interface EmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
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

export const openAIEmbeddingProvider = (
  options: OpenAIProviderOptions = {}
): EmbeddingProvider => ({
  id: OPENAI_EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
  embed: (texts) =>
    generateEmbeddings(texts, {
      model: OPENAI_EMBEDDING_MODEL,
      apiKey: options.apiKey,
      fetch: options.fetch,
    }),
});

/**
 * Local models for experimentation. Their native dimension differs, so they are
 * only usable once `EMBEDDING_DIMENSIONS` matches — hence the guard rather than
 * a silent mismatch that would fail at insert time.
 */
export const ollamaEmbeddingProvider = (
  model: OllamaEmbeddingModel = OLLAMA_EMBEDDING_MODEL
): EmbeddingProvider => ({
  id: model,
  dimensions: EMBEDDING_DIMENSIONS,
  embed: async (texts) => {
    if (!(await isOllamaEnabled(model))) {
      throw new Error(`Ollama model "${model}" is unavailable`);
    }
    return await ollamaEmbeddings(texts, model, "search_document");
  },
});

/**
 * Resolves the provider for this process. `EMBEDDING_PROVIDER=ollama` opts into
 * the local model; anything else uses OpenAI.
 */
export const resolveEmbeddingProvider = (
  options: OpenAIProviderOptions = {}
): EmbeddingProvider =>
  process.env.EMBEDDING_PROVIDER === "ollama"
    ? ollamaEmbeddingProvider()
    : openAIEmbeddingProvider(options);

/**
 * The value stored in `feed_translation.index_key`.
 *
 * Folds the strategy version and the provider id together with the content
 * hash, so a change to any of the three re-indexes exactly the rows it should.
 */
export const buildIndexKey = (params: {
  provider: EmbeddingProvider;
  contentHash: string;
}): string =>
  `${EMBEDDING_INDEX_VERSION}:${params.provider.id}:${params.contentHash}`;
