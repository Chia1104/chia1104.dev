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

  const maxChars = 2000;

  if (content.length <= maxChars) {
    const [embedding] = (
      await ollama.embed({
        model,
        input: content,
        dimensions: 512,
      })
    ).embeddings;
    return embedding;
  }

  /* ===============================
   * @TODO: Handle large context
   * ===============================
   */

  const chunks: string[] = [];
  for (let i = 0; i < content.length; i += maxChars) {
    chunks.push(content.substring(i, i + maxChars));
  }

  const embeddings = (
    await ollama.embed({
      model,
      input: chunks,
      dimensions: 512,
    })
  ).embeddings;

  const avgEmbedding = new Array<number>(512).fill(0);
  for (const embedding of embeddings) {
    for (let i = 0; i < 512; i++) {
      avgEmbedding[i] += embedding[i] / embeddings.length;
    }
  }

  const magnitude = Math.sqrt(
    avgEmbedding.reduce((sum, val) => sum + val * val, 0)
  );

  if (magnitude > 0) {
    for (let i = 0; i < avgEmbedding.length; i++) {
      avgEmbedding[i] /= magnitude;
    }
  }

  return avgEmbedding;
};
