import type { Tiktoken } from "js-tiktoken";

import {
  EMBEDDING_MAX_TOKENS,
  estimateEmbeddingTokens,
  truncateForEmbedding,
} from "./utils.ts";

/**
 * Exact token counting for embedding inputs.
 *
 * The heuristic in `utils.ts` systematically *under*-counts Traditional
 * Chinese: cl100k_base gives common hanzi 1 token but falls back to UTF-8
 * bytes (2–3 tokens) for less common ones, so a `zh-TW` article estimated at
 * 7500 could really be 9000+ and the provider rejects it with
 * `maximum input length is 8192 tokens`.
 *
 * This module lives apart from `chunking.ts` on purpose: query-side paths
 * that only need a token count should not depend on the segmentation logic.
 */

/**
 * Memoized on the module so the BPE ranks are parsed once per process instead
 * of once per translation. The import stays dynamic because the encoding table
 * must not be bundled into builds that never embed.
 *
 * The encoding costs ~32MB of retained heap and `js-tiktoken`'s `Tiktoken` has
 * no `free()`, so once loaded it stays for the life of the process. That is
 * the right trade for the indexing workflow, which tokenizes every translation
 * — but it must not be paid by a process that only ever embeds short search
 * queries. Hence `withinBudgetByEstimate` below: callers that provably do not
 * need exact counting never trigger the load at all.
 */
let encodingPromise: Promise<Tiktoken> | null = null;

/** Whether the encoding is currently resident (diagnostics and tests). */
export const isTokenizerLoaded = (): boolean => encodingPromise !== null;

/**
 * True when even the deliberately pessimistic estimate fits the budget.
 *
 * `estimateEmbeddingTokens` never under-counts, so "the estimate fits" implies
 * "the exact count fits" — the tokenizer would only confirm what we already
 * know, at the cost of 32MB. Search queries (capped at 256 characters) always
 * take this path.
 */
const withinBudgetByEstimate = (text: string, maxTokens: number): boolean =>
  estimateEmbeddingTokens(text) <= maxTokens;

export const loadTokenizer = async (
  encoding?: Tiktoken | null
): Promise<Tiktoken> => {
  if (encoding) {
    return encoding;
  }
  encodingPromise ??= import("js-tiktoken")
    .then((module) => module.getEncoding("cl100k_base"))
    .catch((error: unknown) => {
      // let the next caller retry instead of caching the failure forever
      encodingPromise = null;
      throw error;
    });
  return encodingPromise;
};

/**
 * Loads the tokenizer, or resolves `null` when it is unavailable (edge
 * runtimes without dynamic import, missing optional dependency). Callers fall
 * back to the heuristic rather than failing the whole indexing run.
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
 * Truncates to an exact token budget: encode, slice, decode. No safety margin
 * is needed because the count is not an estimate.
 *
 * Falls back to the (deliberately over-counting) heuristic when the tokenizer
 * is unavailable, so the result is still within the limit — just shorter.
 */
export const truncateForEmbeddingExact = async (
  text: string,
  maxTokens = EMBEDDING_MAX_TOKENS
): Promise<string> => {
  // provably within budget — no truncation possible, so no tokenizer needed
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
   * Exact when the tokenizer ran; the pessimistic estimate when the input was
   * small enough to skip it. Callers may only use this as an upper bound —
   * `generateEmbeddings` sizes batches with it, which is safe because the
   * estimate over-counts (batches come out smaller, never oversized).
   */
  tokenCount: number;
  truncated: boolean;
}

/**
 * Last line of defence before an embedding API call: guarantees the input is
 * within the model's limit, and logs when something upstream let an oversized
 * one through. An under-estimate must never reach the provider as a 400, and
 * when it happens the log has to say which input it was.
 */
export const guardEmbeddingInput = async (
  text: string,
  context: { model: string; index?: number; label?: string },
  maxTokens = EMBEDDING_MAX_TOKENS
): Promise<TokenGuardResult> => {
  // Fast path for anything comfortably inside the budget — search queries are
  // capped at 256 characters and can never approach the limit, so the query
  // path must not drag the encoding into a long-lived web process.
  if (withinBudgetByEstimate(text, maxTokens)) {
    return {
      text,
      tokenCount: estimateEmbeddingTokens(text),
      truncated: false,
    };
  }

  const encoding = await tryLoadTokenizer();
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
 * Guards a whole batch, keeping input order so the returned vectors still line
 * up with the caller's rows.
 */
export const guardEmbeddingInputs = async (
  inputs: string[],
  context: { model: string; label?: string },
  maxTokens = EMBEDDING_MAX_TOKENS
): Promise<TokenGuardResult[]> => {
  const results: TokenGuardResult[] = [];
  for (const [index, input] of inputs.entries()) {
    results.push(
      await guardEmbeddingInput(input, { ...context, index }, maxTokens)
    );
  }
  return results;
};
