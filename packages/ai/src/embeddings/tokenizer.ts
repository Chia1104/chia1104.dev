import type { Tiktoken } from "js-tiktoken/lite";

import {
  EMBEDDING_MAX_TOKENS,
  estimateEmbeddingTokens,
  truncateForEmbedding,
} from "./utils.ts";

/**
 * Exact token counting for embedding inputs.
 *
 * The heuristic in `utils.ts` under-counts Traditional Chinese: cl100k_base
 * gives common hanzi 1 token but falls back to UTF-8 bytes (2-3 tokens) for
 * less common ones, so a `zh-TW` article estimated at 7500 can be 9000+ and
 * the provider rejects it with `maximum input length is 8192 tokens`.
 *
 * Lives apart from `chunking.ts` so query-side paths that only need a token
 * count do not depend on segmentation.
 */

/**
 * True when even the pessimistic estimate fits the budget.
 *
 * `estimateEmbeddingTokens` never under-counts, so a fit implies the exact
 * count fits. Loading the tokenizer would only confirm that, at 32MB.
 * Search queries (capped at 256 characters) always take this path.
 */
const withinBudgetByEstimate = (text: string, maxTokens: number): boolean =>
  estimateEmbeddingTokens(text) <= maxTokens;

/**
 * Creates a tokenizer for one operation.
 *
 * Do not retain the instance at module scope. `Tiktoken` expands the BPE
 * ranks into large `Map`s, so a module-level promise would keep them alive
 * for the lifetime of a warm worker. Dynamically imported modules may stay
 * in the import cache; the expanded instance becomes collectible when its
 * caller finishes. The lite entry plus one rank table also avoids loading
 * every tokenizer `js-tiktoken` ships.
 */
export const loadTokenizer = async (): Promise<Tiktoken> => {
  const [{ Tiktoken }, { default: cl100kBase }] = await Promise.all([
    import("js-tiktoken/lite"),
    import("js-tiktoken/ranks/cl100k_base"),
  ]);

  return new Tiktoken(cl100kBase);
};

/**
 * Loads the tokenizer, or `null` when it is unavailable (edge runtimes
 * without dynamic import, missing optional dependency). Callers fall back
 * to the heuristic rather than failing the indexing run.
 */
export const tryLoadTokenizer = async (): Promise<Tiktoken | null> => {
  try {
    return await loadTokenizer();
  } catch (error) {
    console.warn(
      "[embeddings] tiktoken unavailable, falling back to token estimate",
      error
    );
    return null;
  }
};

/** Exact token count for chunk sizing (text-embedding-3-* use cl100k_base). */
export const countEmbeddingTokens = (
  text: string,
  encoding: Tiktoken | null
): number => {
  if (!encoding) throw new Error("Tokenizer not loaded.");
  return encoding.encode(text).length;
};

/** Exact when the tokenizer loads, heuristic when it does not. */
export const countEmbeddingTokensAsync = async (
  text: string
): Promise<number> => {
  const encoding = await tryLoadTokenizer();
  return encoding ? encoding.encode(text).length : estimateEmbeddingTokens(text);
};

/**
 * Truncates to an exact token budget: encode, slice, decode. No safety
 * margin is needed because the count is not an estimate.
 *
 * Falls back to the over-counting heuristic when the tokenizer is
 * unavailable, so the result is still within the limit, just shorter.
 */
export const truncateForEmbeddingExact = async (
  text: string,
  maxTokens = EMBEDDING_MAX_TOKENS
): Promise<string> => {
  // Estimate already within budget: no truncation possible, so no tokenizer
  if (withinBudgetByEstimate(text, maxTokens)) {
    return text;
  }
  const encoding = await tryLoadTokenizer();
  if (!encoding) {
    return truncateForEmbedding(text, maxTokens);
  }
  return truncateWithEncoding(text, maxTokens, encoding);
};

/** Synchronous exact truncation for callers that already hold an encoding. */
export const truncateWithEncoding = (
  text: string,
  maxTokens: number,
  encoding: Tiktoken
): string => {
  const tokens = encoding.encode(text);
  if (tokens.length <= maxTokens) {
    return text;
  }
  return encoding.decode(tokens.slice(0, maxTokens));
};

export interface TokenGuardResult {
  text: string;
  /**
   * Exact when the tokenizer ran; the pessimistic estimate when the input
   * was small enough to skip it. Callers may only use this as an upper bound.
   * `generateEmbeddings` sizes batches with it, which is safe because the
   * estimate over-counts (batches come out smaller, never oversized).
   */
  tokenCount: number;
  truncated: boolean;
}

const guardEmbeddingInputWithEncoding = (
  text: string,
  context: { model: string; index?: number; label?: string },
  maxTokens: number,
  encoding: Tiktoken | null
): TokenGuardResult => {
  if (withinBudgetByEstimate(text, maxTokens)) {
    return {
      text,
      tokenCount: estimateEmbeddingTokens(text),
      truncated: false,
    };
  }

  if (!encoding) {
    const fallback = truncateForEmbedding(text, maxTokens);
    return {
      text: fallback,
      tokenCount: estimateEmbeddingTokens(fallback),
      truncated: fallback.length !== text.length,
    };
  }

  const tokens = encoding.encode(text);
  if (tokens.length <= maxTokens) {
    return { text, tokenCount: tokens.length, truncated: false };
  }

  console.warn("[embeddings] input exceeded token limit, truncating", {
    model: context.model,
    index: context.index,
    label: context.label,
    tokenCount: tokens.length,
    maxTokens,
  });

  return {
    text: encoding.decode(tokens.slice(0, maxTokens)),
    tokenCount: maxTokens,
    truncated: true,
  };
};

/**
 * Last line of defence before an embedding API call. Guarantees the input
 * is within the model limit and logs when something upstream let an
 * oversized one through. An under-estimate must never reach the provider as
 * a 400; the log has to say which input it was.
 */
export const guardEmbeddingInput = async (
  text: string,
  context: { model: string; index?: number; label?: string },
  maxTokens = EMBEDDING_MAX_TOKENS
): Promise<TokenGuardResult> => {
  // Search queries are capped at 256 characters and should not initialize the
  // tokenizer in a long-lived web process.
  const encoding = withinBudgetByEstimate(text, maxTokens)
    ? null
    : await tryLoadTokenizer();

  return guardEmbeddingInputWithEncoding(
    text,
    context,
    maxTokens,
    encoding
  );
};

/**
 * Guards a whole batch, keeping input order so returned vectors still line
 * up with the caller's rows.
 */
export const guardEmbeddingInputs = async (
  inputs: string[],
  context: { model: string; label?: string },
  maxTokens = EMBEDDING_MAX_TOKENS
): Promise<TokenGuardResult[]> => {
  // Keep one tokenizer only for this batch. This avoids constructing one per
  // oversized input without turning it back into a process-lifetime cache.
  const encoding = inputs.some(
    (input) => !withinBudgetByEstimate(input, maxTokens)
  )
    ? await tryLoadTokenizer()
    : null;

  return inputs.map((input, index) =>
    guardEmbeddingInputWithEncoding(
      input,
      { ...context, index },
      maxTokens,
      encoding
    )
  );
};
