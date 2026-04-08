import type OpenAI from "openai";
import type { ClientOptions } from "openai";

import { TextEmbeddingModel } from "./utils.ts";

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
  const input = value.replaceAll("\n", " ");

  const { data } = await client.embeddings.create({
    model,
    input,
    dimensions: 1536,
  });

  return data[0]?.embedding;
};
