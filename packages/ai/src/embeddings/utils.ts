import * as z from "zod";

// https://ollama.com/blog/embedding-models
export const OllamaEmbeddingModel = {
  "mxbai-embed-large": "mxbai-embed-large",
  "nomic-embed-text": "nomic-embed-text",
  "all-minilm": "all-minilm",
} as const;

export const ollamaEmbeddingModelSchema = z.enum(OllamaEmbeddingModel);

export type OllamaEmbeddingModel = z.infer<typeof ollamaEmbeddingModelSchema>;

export const isOllamaEmbeddingModel = (
  model?: unknown
): model is OllamaEmbeddingModel => {
  return z.enum(OllamaEmbeddingModel).safeParse(model).success;
};

// https://platform.openai.com/docs/guides/embeddings
export const TextEmbeddingModel = {
  "3-small": "text-embedding-3-small",
  "3-large": "text-embedding-3-large",
} as const;

export const textEmbeddingModelSchema = z.enum(TextEmbeddingModel);

export type TextEmbeddingModel = z.infer<typeof textEmbeddingModelSchema>;

export const isOpenAIEmbeddingModel = (
  model?: unknown
): model is TextEmbeddingModel => {
  return textEmbeddingModelSchema.safeParse(model).success;
};

export type EmbeddingModel = TextEmbeddingModel | OllamaEmbeddingModel;

/**
 * Dimensions each model is embedded with in this project (may be lower than
 * the model's native dimensions for Matryoshka models).
 */
export const EMBEDDING_MODEL_DIMENSIONS = {
  [TextEmbeddingModel["3-small"]]: 1536,
  [TextEmbeddingModel["3-large"]]: 1536,
  [OllamaEmbeddingModel["nomic-embed-text"]]: 512,
  [OllamaEmbeddingModel["mxbai-embed-large"]]: 512,
  [OllamaEmbeddingModel["all-minilm"]]: 512,
} as const satisfies Record<EmbeddingModel, 512 | 1536>;

export type EmbeddingDimensions =
  (typeof EMBEDDING_MODEL_DIMENSIONS)[EmbeddingModel];

/**
 * Bump when preprocessing, chunking strategy, or embedding parameters change
 * in a way that requires re-embedding. Stale detection compares this together
 * with the content hash; rows are re-embedded in place.
 */
export const EMBEDDING_INDEX_VERSION = "2026-07-14.1";

export interface EmbeddingModelConfig {
  model: EmbeddingModel;
  provider: "openai" | "ollama";
  dimensions: EmbeddingDimensions;
  /** written by the indexing workflow */
  indexed: boolean;
  /** powers related feeds / default search; exactly one model may be canonical */
  canonical: boolean;
  /** selectable for query-time vector search */
  queryEnabled: boolean;
  /** default similarity threshold; calibrate per model with golden queries */
  defaultThreshold: number;
}

/**
 * Single source of truth for embedding models, shared by the indexing
 * workflow, search API, and dashboard. Query-side code must not offer models
 * that the workflow does not index.
 */
export const EMBEDDING_MODEL_REGISTRY = {
  [TextEmbeddingModel["3-small"]]: {
    model: TextEmbeddingModel["3-small"],
    provider: "openai",
    dimensions: EMBEDDING_MODEL_DIMENSIONS[TextEmbeddingModel["3-small"]],
    indexed: true,
    canonical: true,
    queryEnabled: true,
    defaultThreshold: 0.3,
  },
  [TextEmbeddingModel["3-large"]]: {
    model: TextEmbeddingModel["3-large"],
    provider: "openai",
    dimensions: EMBEDDING_MODEL_DIMENSIONS[TextEmbeddingModel["3-large"]],
    indexed: false,
    canonical: false,
    queryEnabled: false,
    defaultThreshold: 0.3,
  },
  [OllamaEmbeddingModel["nomic-embed-text"]]: {
    model: OllamaEmbeddingModel["nomic-embed-text"],
    provider: "ollama",
    dimensions:
      EMBEDDING_MODEL_DIMENSIONS[OllamaEmbeddingModel["nomic-embed-text"]],
    indexed: true,
    canonical: false,
    queryEnabled: true,
    defaultThreshold: 0.3,
  },
  [OllamaEmbeddingModel["mxbai-embed-large"]]: {
    model: OllamaEmbeddingModel["mxbai-embed-large"],
    provider: "ollama",
    dimensions:
      EMBEDDING_MODEL_DIMENSIONS[OllamaEmbeddingModel["mxbai-embed-large"]],
    indexed: false,
    canonical: false,
    queryEnabled: false,
    defaultThreshold: 0.3,
  },
  [OllamaEmbeddingModel["all-minilm"]]: {
    model: OllamaEmbeddingModel["all-minilm"],
    provider: "ollama",
    dimensions: EMBEDDING_MODEL_DIMENSIONS[OllamaEmbeddingModel["all-minilm"]],
    indexed: false,
    canonical: false,
    queryEnabled: false,
    defaultThreshold: 0.3,
  },
} as const satisfies Record<EmbeddingModel, EmbeddingModelConfig>;

export const getEmbeddingModelConfig = (
  model: EmbeddingModel
): EmbeddingModelConfig => EMBEDDING_MODEL_REGISTRY[model];

/** Models the indexing workflow writes for every translation. */
export const INDEXED_EMBEDDING_MODELS = Object.values(EMBEDDING_MODEL_REGISTRY)
  .filter((config) => config.indexed)
  .map((config) => config.model);

/** Models the search API / dashboard may offer for vector search. */
export const QUERYABLE_EMBEDDING_MODELS = Object.values(
  EMBEDDING_MODEL_REGISTRY
)
  .filter((config) => config.indexed && config.queryEnabled)
  .map((config) => config.model);

export const CANONICAL_EMBEDDING_MODEL = Object.values(
  EMBEDDING_MODEL_REGISTRY
).find((config) => config.canonical)!.model;

export const isQueryableEmbeddingModel = (
  model?: unknown
): model is EmbeddingModel =>
  (QUERYABLE_EMBEDDING_MODELS as readonly unknown[]).includes(model);

/**
 * Normalizes a search query for cache identity: collapse whitespace and
 * lowercase, but keep punctuation — "pg-vector" and "pg vector" are different
 * queries. Hash the result (sha-256) to build the cache key.
 */
export const normalizeQueryForEmbedding = (query: string): string =>
  query.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Asymmetric embedding task type. Models like nomic-embed-text require
 * different prefixes for documents (index time) and queries (search time).
 */
export type EmbeddingTask = "search_document" | "search_query";

// text-embedding-3-* accept at most 8191 tokens; keep a safety margin
// since we only estimate the token count.
export const EMBEDDING_MAX_TOKENS = 7500;

// CJK unified ideographs (incl. ext-A), compatibility ideographs, kana, hangul, fullwidth forms
const CJK_CHAR_REGEX =
  /[\u3000-\u9fff\uf900-\ufaff\uac00-\ud7af\u3040-\u30ff\uff00-\uffef]/;

/**
 * Conservative token estimate without a tokenizer dependency:
 * CJK characters count as 1 token, everything else as half a token.
 */
export const estimateEmbeddingTokens = (text: string): number => {
  let tokens = 0;
  for (const char of text) {
    tokens += CJK_CHAR_REGEX.test(char) ? 1 : 0.5;
  }
  return Math.ceil(tokens);
};

/**
 * Truncates text so the estimated token count stays within the model limit.
 */
export const truncateForEmbedding = (
  text: string,
  maxTokens = EMBEDDING_MAX_TOKENS
): string => {
  let tokens = 0;
  let end = 0;
  for (const char of text) {
    tokens += CJK_CHAR_REGEX.test(char) ? 1 : 0.5;
    if (tokens > maxTokens) {
      return text.slice(0, end);
    }
    end += char.length;
  }
  return text;
};

/**
 * Strips MDX/Markdown noise (imports, JSX tags, code blocks, md syntax) so
 * the embedding captures the article topic instead of markup.
 */
export const stripMdx = (source: string): string => {
  return source
    .replace(/```[\s\S]*?(```|$)/g, " ") // fenced code blocks
    .replace(/^(?:import|export)\s[^\n]*$/gm, " ") // ESM statements
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images -> alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> label
    .replace(/<\/?[A-Za-z][^>\n]*>/g, " ") // JSX / HTML tags
    .replace(/`([^`]*)`/g, "$1") // inline code
    .replace(/^[#>\-*+\s]+/gm, "") // headings, quotes, list markers
    .replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, "$1") // emphasis
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Builds the canonical text to embed for a feed translation:
 * title + summary (or description) + stripped content.
 */
export const buildEmbeddingInput = (input: {
  title?: string | null;
  description?: string | null;
  summary?: string | null;
  content?: string | null;
}): string => {
  return [
    input.title,
    input.summary?.trim() ? input.summary : input.description,
    input.content ? stripMdx(input.content) : null,
  ]
    .filter((part): part is string => !!part?.trim())
    .join("\n\n");
};

/**
 * sha-256 hex digest of the embedding input, stored alongside the vectors so
 * indexing can skip re-embedding unchanged content. Uses Web Crypto to stay
 * runtime-agnostic (Node / edge).
 */
export const hashEmbeddingInput = async (input: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};
