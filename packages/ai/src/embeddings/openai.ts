import type OpenAI from "openai";
import { z } from "zod";

import { createOpenAI } from "..";

// https://platform.openai.com/docs/guides/embeddings
export const TextEmbeddingModel = {
  "ada-002": "text-embedding-ada-002",
  "3-small": "text-embedding-3-small",
  "3-large": "text-embedding-3-large",
} as const;

export const textEmbeddingModelSchema = z.nativeEnum(TextEmbeddingModel);

export type TextEmbeddingModel = z.infer<typeof textEmbeddingModelSchema>;

export interface Options {
  client?: OpenAI;
  model?: TextEmbeddingModel;
}

export const generateEmbedding = async (value: string, options?: Options) => {
  options ??= {};
  const { client = createOpenAI(), model = TextEmbeddingModel["ada-002"] } =
    options;
  const input = value.replaceAll("\n", " ");

  const { data } = await client.embeddings.create({
    model,
    input,
  });

  console.log(data);

  return data[0]?.embedding;
};
