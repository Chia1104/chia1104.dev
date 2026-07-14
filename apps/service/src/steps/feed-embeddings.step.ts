import { fetch, FatalError } from "workflow";

import { chunkMarkdownForEmbedding } from "@chia/ai/embeddings/chunking";
import type { MarkdownChunk } from "@chia/ai/embeddings/chunking";
import { ollamaEmbeddings } from "@chia/ai/embeddings/ollama";
import { generateEmbeddings } from "@chia/ai/embeddings/openai";
import {
  buildEmbeddingInput,
  EMBEDDING_INDEX_VERSION,
  hashEmbeddingInput,
  isOllamaEmbeddingModel,
  isOpenAIEmbeddingModel,
} from "@chia/ai/embeddings/utils";
import type { EmbeddingModel } from "@chia/ai/embeddings/utils";
import { isOllamaEnabled } from "@chia/ai/ollama/utils";
import { connectDatabase } from "@chia/db/client";
import { getFeedForIndexing } from "@chia/db/repos/feeds";
import {
  getFeedEmbeddingMeta,
  replaceFeedEmbeddings,
} from "@chia/db/repos/feeds/embedding";

export interface TranslationSource {
  translationID: number;
  locale: string;
  title: string;
  description: string | null;
  summary: string | null;
  content: string | null;
}

/**
 * Loads the feed's raw translation sources. Runs as a step so the workflow
 * replays the same snapshot on retries.
 */
export const loadFeedForEmbeddingStep = async (feedID: number) => {
  "use step";

  const db = await connectDatabase();
  const feed = await getFeedForIndexing(db, { feedId: feedID });
  if (!feed) {
    return null;
  }

  return {
    enabled: feed.published && !feed.deletedAt,
    translations: feed.translations.map(
      (translation): TranslationSource => ({
        translationID: translation.id,
        locale: translation.locale,
        title: translation.title,
        description: translation.description,
        summary: translation.summary,
        content: translation.content?.content ?? null,
      })
    ),
  };
};

/**
 * Builds everything derived from the source content in one deterministic
 * step: the content hash (over the raw source, so code-only edits also
 * re-embed), the topic-level document input, and structure-aware chunks.
 */
export const prepareTranslationEmbeddingStep = async (
  translation: TranslationSource
) => {
  "use step";

  const contentHash = await hashEmbeddingInput(
    JSON.stringify({
      title: translation.title,
      description: translation.description,
      summary: translation.summary,
      content: translation.content,
    })
  );
  const documentInput = buildEmbeddingInput({
    title: translation.title,
    description: translation.description,
    summary: translation.summary,
    content: translation.content,
  });
  const chunks = translation.content
    ? await chunkMarkdownForEmbedding({
        title: translation.title,
        content: translation.content,
      })
    : [];

  return { contentHash, documentInput, chunks };
};

/**
 * Diffs the (contentHash, indexVersion) pair against the stored document
 * rows and returns only the models whose vectors are stale.
 */
export const resolveStaleModelsStep = async (
  translationID: number,
  contentHash: string,
  models: readonly EmbeddingModel[]
) => {
  "use step";

  const db = await connectDatabase();
  const existing = await getFeedEmbeddingMeta(db, {
    feedTranslationId: translationID,
  });

  return models.filter((model) => {
    const row = existing.find((candidate) => candidate.model === model);
    return (
      !row ||
      row.contentHash !== contentHash ||
      row.indexVersion !== EMBEDDING_INDEX_VERSION
    );
  });
};

/**
 * Generates all embeddings for one model in a single batched call
 * (document + chunks). OpenAI failures map 4xx (except 408/429) to
 * FatalError so the step doesn't burn retries on permanent errors; anything
 * else rethrows and relies on the step's automatic retry. Ollama is treated
 * as optional — unavailable (e.g. in production) simply yields null.
 */
export const generateFeedEmbeddingsStep = async (
  inputs: string[],
  model: EmbeddingModel
): Promise<number[][] | null> => {
  "use step";

  if (isOllamaEmbeddingModel(model)) {
    if (!(await isOllamaEnabled(model))) {
      return null;
    }
    try {
      return await ollamaEmbeddings(inputs, model, "search_document");
    } catch (error) {
      console.warn("Failed to generate Ollama embeddings, skipping", {
        model,
        error,
      });
      return null;
    }
  }

  if (!isOpenAIEmbeddingModel(model)) {
    throw new FatalError(`Unsupported embedding model: ${model}`);
  }

  try {
    return await generateEmbeddings(inputs, { model, fetch });
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status?: unknown }).status)
        : undefined;
    if (
      status &&
      status >= 400 &&
      status < 500 &&
      status !== 408 &&
      status !== 429
    ) {
      throw new FatalError(
        `OpenAI embedding request failed permanently (${status}): ${String(error)}`
      );
    }
    // transient (429 / 5xx / network) — let the step retry
    throw error;
  }
};

export const saveFeedEmbeddingsStep = async (params: {
  translationID: number;
  model: EmbeddingModel;
  contentHash: string;
  documentEmbedding: number[];
  chunks: (Pick<
    MarkdownChunk,
    "chunkIndex" | "chunkText" | "headingPath" | "tokenCount"
  > & { embedding: number[] })[];
}) => {
  "use step";

  const db = await connectDatabase();
  return await replaceFeedEmbeddings(db, {
    feedTranslationId: params.translationID,
    model: params.model,
    contentHash: params.contentHash,
    indexVersion: EMBEDDING_INDEX_VERSION,
    document: { embedding: params.documentEmbedding },
    chunks: params.chunks,
  });
};
