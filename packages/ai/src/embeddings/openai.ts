import { createOpenAI } from "..";

const openai = createOpenAI();

export const generateEmbedding = async (value: string): Promise<number[]> => {
  const input = value.replaceAll("\n", " ");

  const { data } = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input,
  });

  return data[0].embedding;
};
