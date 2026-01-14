import type { OllamaEmbeddingModel } from "@chia/ai/embeddings/ollama";
import { ollama } from "@chia/ai/ollama";
import { isOllamaEnabled } from "@chia/ai/ollama/utils";
import { connectDatabase } from "@chia/db/client";
import { upsertFeedTranslation, getFeedById } from "@chia/db/repos/feeds";
import type { Locale } from "@chia/db/types";

export const getFeedByIdStep = async (feedID: number) => {
  "use step";
  const db = await connectDatabase();
  return await getFeedById(db, {
    feedId: feedID,
  });
};

export const upsertFeedTranslationStep = async (
  feedID: number,
  locale: Locale,
  embedding: number[]
) => {
  "use step";
  const db = await connectDatabase();
  return await upsertFeedTranslation(db, {
    feedId: feedID,
    locale: locale,
    embedding512: embedding,
  });
};

export const ollamaEmbeddingStep = async (
  content: string,
  model: OllamaEmbeddingModel
) => {
  "use step";
  if (!(await isOllamaEnabled(model))) {
    return null;
  }

  const [embedding] = (
    await ollama.embed({
      model,
      input: content,
      dimensions: 512,
    })
  ).embeddings;

  return embedding;
};
