import { createOpenAI as createAiSdkOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";
import type OpenAI from "openai";
import type { ClientOptions } from "openai";

import { guardEmbeddingInput, guardEmbeddingInputs } from "./tokenizer.ts";
import {
  EMBEDDING_BATCH_MAX_INPUTS,
  EMBEDDING_BATCH_MAX_TOKENS,
  EMBEDDING_DIMENSIONS,
} from "./utils.ts";

/** OpenAI's embedding models all share one tokenizer and one request shape. */
export type TextEmbeddingModel =
  | "text-embedding-3-small"
  | "text-embedding-3-large";

export interface Options {
  client?: OpenAI;
  model?: TextEmbeddingModel;
  clientOptions?: ClientOptions;
}

export const generateEmbedding = async (value: string, options?: Options) => {
  options ??= {};
  const {
    client = (await import("../index.ts").then((m) => m.createOpenAI))(
      options?.clientOptions
    ),
    model = "text-embedding-3-small",
  } = options;
  // keep the input within the model's token limit; long articles would
  // otherwise be rejected by the API
  const { text: input } = await guardEmbeddingInput(
    value.replaceAll("\n", " "),
    { model }
  );

  const { data } = await client.embeddings.create({
    model,
    input,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return data[0]?.embedding;
};

export interface BatchOptions {
  model?: TextEmbeddingModel;
  apiKey?: string;
  fetch?: (
    input: string | URL | Request,
    init?: RequestInit
  ) => Promise<Response>;
  /** defaults to `EMBEDDING_BATCH_MAX_INPUTS` */
  maxInputsPerRequest?: number;
  /** defaults to `EMBEDDING_BATCH_MAX_TOKENS` */
  maxTokensPerRequest?: number;
}

/**
 * Splits inputs into requests that respect both the array-length and the
 * total-token ceiling. A long article with many chunks would otherwise exceed
 * the per-request token limit even though every individual input fits.
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
 * Batch embedding via the AI SDK. Inputs are token-guarded and split into
 * requests that stay under the per-request limits; vectors come back in input
 * order. Failures propagate so the calling workflow step's retry handles them.
 */
export const generateEmbeddings = async (
  values: string[],
  options?: BatchOptions
): Promise<number[][]> => {
  if (values.length === 0) {
    return [];
  }
  const model = options?.model ?? "text-embedding-3-small";
  const provider = createAiSdkOpenAI({
    apiKey: options?.apiKey ?? process.env.OPENAI_API_KEY,
    // the SDK types demand fetch.preconnect but never call it; the workflow
    // runtime's instrumented fetch does not carry it
    fetch: options?.fetch as typeof globalThis.fetch | undefined,
  });

  const guarded = await guardEmbeddingInputs(values, { model });
  const batches = buildBatches(
    guarded,
    options?.maxInputsPerRequest ?? EMBEDDING_BATCH_MAX_INPUTS,
    options?.maxTokensPerRequest ?? EMBEDDING_BATCH_MAX_TOKENS
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
