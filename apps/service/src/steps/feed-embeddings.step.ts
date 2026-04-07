import { fetch } from "workflow";

import { generateEmbedding } from "@chia/ai/embeddings/openai";
import { TextEmbeddingModel } from "@chia/ai/embeddings/utils";
import { connectDatabase } from "@chia/db/client";
import { upsertFeedTranslation } from "@chia/db/repos/feeds";
import type { Locale } from "@chia/db/types";

export const upsertFeedTranslationStep = async (
  feedID: number,
  locale: Locale,
  embeddings: {
    1536?: number[];
    512?: number[];
  }
) => {
  "use step";
  const db = await connectDatabase();
  return await upsertFeedTranslation(db, {
    feedId: feedID,
    locale: locale,
    embedding512: embeddings[512],
    embedding: embeddings[1536],
  });
};

export const generateEmbeddingStep = async (content: string) => {
  "use step";

  return await generateEmbedding(content, {
    model: TextEmbeddingModel["3-small"],
    clientOptions: {
      fetch,
    },
  });
};
