import { buildHeadingOutline, stripMdx } from "./markdown.ts";

/**
 * One dimension, one column. Changing this is a schema change plus a reindex.
 */
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Bump when preprocessing, the document card, or embedding parameters
 * change in a way that requires re-embedding. Folded into `index_key` with
 * the provider id, so stale rows re-embed in place.
 */
export const EMBEDDING_INDEX_VERSION = "2026-09-01.1";

/**
 * Asymmetric task. Models like nomic-embed-text need different prefixes for
 * documents (index time) and queries (search time).
 */
export type EmbeddingTask = "search_document" | "search_query";

/** Local model ids; used for Ollama task prefixes and model listing. */
export const OllamaEmbeddingModel = {
  "mxbai-embed-large": "mxbai-embed-large",
  "nomic-embed-text": "nomic-embed-text",
  "all-minilm": "all-minilm",
} as const;

export type OllamaEmbeddingModel =
  (typeof OllamaEmbeddingModel)[keyof typeof OllamaEmbeddingModel];

/**
 * Native output width of each local model. Only `nomic-embed-text` (v1.5) is
 * Matryoshka-trained; the others ignore a dimensions request and return
 * their native width. `resolveEmbeddingProvider` compares these against
 * `EMBEDDING_DIMENSIONS`.
 */
export const OLLAMA_EMBEDDING_DIMENSIONS = {
  "mxbai-embed-large": 1024,
  "nomic-embed-text": 768,
  "all-minilm": 384,
} satisfies Record<OllamaEmbeddingModel, number>;

/**
 * Input limit each local model was trained for, not the architecture
 * ceiling. The server silently truncates above this, so guarding here keeps
 * stored text and the vector in sync.
 */
export const OLLAMA_EMBEDDING_MAX_TOKENS = {
  "mxbai-embed-large": 512,
  "nomic-embed-text": 8192,
  "all-minilm": 256,
} satisfies Record<OllamaEmbeddingModel, number>;

/**
 * text-embedding-3-* accept at most 8191 tokens. Counting is exact
 * (`truncateForEmbeddingExact`), so this only leaves a small margin for
 * provider-side differences.
 */
export const EMBEDDING_MAX_TOKENS = 8000;

/** Per-request ceilings for batch embedding calls (OpenAI allows ~300k tokens). */
export const EMBEDDING_BATCH_MAX_INPUTS = 32;
export const EMBEDDING_BATCH_MAX_TOKENS = 250_000;

// CJK unified ideographs (incl. ext-A), compatibility ideographs, kana, hangul, fullwidth forms
const CJK_CHAR_REGEX =
  /[\u3000-\u9fff\uf900-\ufaff\uac00-\ud7af\u3040-\u30ff\uff00-\uffef]/;

/**
 * Tokens a CJK character is assumed to cost in the heuristic.
 *
 * cl100k_base gives common hanzi one token but falls back to UTF-8 bytes
 * (2-3 tokens) for less common ones; Traditional Chinese hits that fallback
 * often. The heuristic must never under-count, so it assumes the worse case.
 */
const CJK_TOKENS_PER_CHAR = 2;
const NON_CJK_TOKENS_PER_CHAR = 0.5;

/**
 * Pessimistic token estimate for runtimes without the tokenizer. Prefer
 * `countEmbeddingTokensAsync` from `./tokenizer.ts`; this is the fallback,
 * not the default.
 */
export const estimateEmbeddingTokens = (text: string): number => {
  let tokens = 0;
  for (const char of text) {
    tokens += CJK_CHAR_REGEX.test(char)
      ? CJK_TOKENS_PER_CHAR
      : NON_CJK_TOKENS_PER_CHAR;
  }
  return Math.ceil(tokens);
};

/**
 * Heuristic truncation. Synchronous for callers that cannot await; also the
 * fallback for `truncateForEmbeddingExact`.
 */
export const truncateForEmbedding = (
  text: string,
  maxTokens = EMBEDDING_MAX_TOKENS
): string => {
  let tokens = 0;
  let end = 0;
  for (const char of text) {
    tokens += CJK_CHAR_REGEX.test(char)
      ? CJK_TOKENS_PER_CHAR
      : NON_CJK_TOKENS_PER_CHAR;
    if (tokens > maxTokens) {
      return text.slice(0, end);
    }
    end += char.length;
  }
  return text;
};

/**
 * Stripped body tokens when a translation has no summary. Kept small: a body
 * excerpt is a poor stand-in for a topic summary.
 */
const CARD_BODY_FALLBACK_TOKENS = 400;

export interface DocumentCardInput {
  title?: string | null;
  description?: string | null;
  summary?: string | null;
  excerpt?: string | null;
  content?: string | null;
  tags?: string[];
}

/**
 * Document card embedded as a translation's topic-level vector. Not the
 * full body: a whole article truncates (the tail never enters the vector)
 * and dilutes the topic. Card length follows document structure, so it
 * cannot approach the model limit as the article grows.
 *
 * Body excerpt only appears when there is no summary/description/excerpt;
 * see `CARD_BODY_FALLBACK_TOKENS`.
 */
export const buildEmbeddingInput = async (
  input: DocumentCardInput
): Promise<string> => {
  const summary = [input.summary, input.description, input.excerpt]
    .map((value) => value?.trim())
    .find((value): value is string => !!value);

  const tags = input.tags?.filter((tag) => !!tag.trim()) ?? [];
  const outline = input.content ? await buildHeadingOutline(input.content) : "";

  // No summary and no structure: fall back to a bounded slice of the body
  // so the vector is not just the title
  const bodyFallback =
    !summary && !outline && input.content
      ? truncateForEmbedding(
          await stripMdx(input.content),
          CARD_BODY_FALLBACK_TOKENS
        )
      : null;

  return [
    input.title ? `Title: ${input.title}` : null,
    summary ? `Summary: ${summary}` : null,
    tags.length > 0 ? `Tags: ${tags.join(", ")}` : null,
    outline ? `Outline:\n${outline}` : null,
    bodyFallback?.trim() ? bodyFallback : null,
  ]
    .filter((part): part is string => !!part?.trim())
    .join("\n\n");
};

/**
 * SHA-256 hex digest of the embedding input, stored alongside the vectors
 * so indexing can skip unchanged content. Uses Web Crypto (Node / edge).
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
