import { createOpenAI as createAiSdkOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";

import { guardEmbeddingInputs } from "./tokenizer.ts";
import {
  EMBEDDING_BATCH_MAX_INPUTS,
  EMBEDDING_BATCH_MAX_TOKENS,
  EMBEDDING_DIMENSIONS,
} from "./utils.ts";

/** OpenAI's embedding models all share one tokenizer and one request shape. */
export type TextEmbeddingModel =
  | "text-embedding-3-small"
  | "text-embedding-3-large";

export interface BatchOptions {
  model?: TextEmbeddingModel;
  /** Explicit so the SDK never falls back to an ambient `OPENAI_API_KEY`. */
  apiKey: string;
  fetch?: (
    input: string | URL | Request,
    init?: RequestInit
  ) => Promise<Response>;
  maxInputsPerRequest?: number;
  maxTokensPerRequest?: number;
}

/**
 * Splits into requests that respect both the array-length and total-token
 * ceilings. A long article's chunks can exceed the per-request token limit
 * even when every individual input fits.
 */
const buildBatches = (
  inputs: { text: string; tokenCount: number }[],
  maxInputs: number,
  maxTokens: number
): { text: string; tokenCount: number }[][] => {
  const batches: { text: string; tokenCount: number }[][] = [];
  let current: { text: string; tokenCount: number }[] = [];
  let currentTokens = 0;

  for (const input of inputs) {
    const wouldExceed =
      current.length >= maxInputs ||
      (current.length > 0 && currentTokens + input.tokenCount > maxTokens);
    if (wouldExceed) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(input);
    currentTokens += input.tokenCount;
  }
  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
};

/**
 * Token-guards inputs and splits them under the per-request limits. Vectors
 * come back in input order. Failures propagate so the workflow step's retry
 * handles them.
 */
export const generateEmbeddings = async (
  values: string[],
  options: BatchOptions
): Promise<number[][]> => {
  if (values.length === 0) {
    return [];
  }
  const model = options.model ?? "text-embedding-3-small";
  const provider = createAiSdkOpenAI({
    apiKey: options.apiKey,
    // SDK types demand fetch.preconnect but never call it; the workflow
    // runtime's instrumented fetch does not carry it
    fetch:
      /* SAFETY: The producer contract guarantees this value satisfies typeof globalThis.fetch | undefined. */ options.fetch as
        | typeof globalThis.fetch
        | undefined,
  });

  const guarded = await guardEmbeddingInputs(values, { model });
  const batches = buildBatches(
    guarded,
    options.maxInputsPerRequest ?? EMBEDDING_BATCH_MAX_INPUTS,
    options.maxTokensPerRequest ?? EMBEDDING_BATCH_MAX_TOKENS
  );

  const embeddings: number[][] = [];
  for (const batch of batches) {
    const result = await embedMany({
      model: provider.embedding(model),
      values: batch.map((input) => input.text),
      providerOptions: {
        openai: { dimensions: EMBEDDING_DIMENSIONS },
      },
    });
    embeddings.push(...result.embeddings);
  }

  return embeddings;
};
