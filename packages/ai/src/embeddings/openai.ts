import { createOpenAI as createAiSdkOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";
import type OpenAI from "openai";
import type { ClientOptions } from "openai";

import {
  EMBEDDING_MODEL_DIMENSIONS,
  TextEmbeddingModel,
  truncateForEmbedding,
} from "./utils.ts";

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
    model = TextEmbeddingModel["3-small"],
  } = options;
  // keep the input within the model's token limit; long articles would
  // otherwise be rejected by the API
  const input = truncateForEmbedding(value.replaceAll("\n", " "));

  const { data } = await client.embeddings.create({
    model,
    input,
    dimensions: 1536,
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
}

/**
 * Batch embedding via the AI SDK — one API call for a document and all of
 * its chunks instead of one call per input. Returns vectors in input order.
 */
export const generateEmbeddings = async (
  values: string[],
  options?: BatchOptions
): Promise<number[][]> => {
  if (values.length === 0) {
    return [];
  }
  const model = options?.model ?? TextEmbeddingModel["3-small"];
  const provider = createAiSdkOpenAI({
    apiKey: options?.apiKey ?? process.env.OPENAI_API_KEY,
    // the SDK types demand fetch.preconnect but never call it; the workflow
    // runtime's instrumented fetch does not carry it
    fetch: options?.fetch as typeof globalThis.fetch | undefined,
  });

  const { embeddings } = await embedMany({
    model: provider.embedding(model),
    values: values.map((value) => truncateForEmbedding(value)),
    providerOptions: {
      openai: { dimensions: EMBEDDING_MODEL_DIMENSIONS[model] },
    },
  });

  return embeddings;
};
