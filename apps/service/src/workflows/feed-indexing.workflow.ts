import * as z from "zod";

import {
  CANONICAL_EMBEDDING_MODEL,
  INDEXED_EMBEDDING_MODELS,
} from "@chia/ai/embeddings/utils";
import type { EmbeddingModel } from "@chia/ai/embeddings/utils";

import { saveFeedToAlgoliaStep } from "../steps/algolia-search.step";
import { estimateReadingTimeStep } from "../steps/estimate-reading-time.step";
import {
  prepareTranslationEmbeddingStep,
  resolveStaleModelsStep,
  generateFeedEmbeddingsStep,
  saveFeedEmbeddingsStep,
  deleteFeedEmbeddingsStep,
} from "../steps/feed-embeddings.step";
import { loadFeedForIndexingStep } from "../steps/feed-indexing.step";
import type { FeedIndexingSnapshot } from "../steps/feed-indexing.step";

export const requestSchema = z.object({
  feedID: z.number(),
});

type Request = z.input<typeof requestSchema>;

export interface ModelResult {
  model: EmbeddingModel;
  status: "saved" | "unavailable" | "failed";
  chunkCount?: number;
  error?: string;
}

export type EmbeddingsResult =
  | { status: "skipped"; reason: string; deletedCount?: number }
  | { status: "processed"; models: ModelResult[] }
  | { status: "failed"; error: string };

export type BranchStatus = "ok" | `failed: ${string}`;

const settledStatus = (result: PromiseSettledResult<unknown>): BranchStatus =>
  result.status === "fulfilled" ? "ok" : `failed: ${String(result.reason)}`;

const indexTranslationEmbeddings = async (
  enabled: boolean,
  translation: FeedIndexingSnapshot["translations"][number]
): Promise<EmbeddingsResult> => {
  if (!enabled) {
    return { status: "skipped", reason: "feed is unpublished" };
  }

  const prepared = await prepareTranslationEmbeddingStep(translation);
  if (!prepared.documentInput) {
    // content was emptied — remove stale vectors so search stops matching
    const { deletedCount } = await deleteFeedEmbeddingsStep(
      translation.translationID
    );
    return { status: "skipped", reason: "no content", deletedCount };
  }

  const staleModels = await resolveStaleModelsStep(
    translation.translationID,
    prepared.contentHash,
    INDEXED_EMBEDDING_MODELS
  );
  if (staleModels.length === 0) {
    return { status: "skipped", reason: "up to date" };
  }

  const inputs = [
    prepared.documentInput,
    ...prepared.chunks.map((chunk) => chunk.embeddingInput),
  ];

  const embedWithModel = async (
    model: EmbeddingModel
  ): Promise<ModelResult> => {
    const embeddings = await generateFeedEmbeddingsStep(inputs, model);
    if (!embeddings) {
      return { model, status: "unavailable" };
    }
    const [documentEmbedding, ...chunkEmbeddings] = embeddings;
    if (
      !documentEmbedding ||
      chunkEmbeddings.length !== prepared.chunks.length
    ) {
      return {
        model,
        status: "failed",
        error: `Expected ${inputs.length} embeddings, received ${embeddings.length}`,
      };
    }
    await saveFeedEmbeddingsStep({
      translationID: translation.translationID,
      model,
      contentHash: prepared.contentHash,
      documentEmbedding,
      chunks: prepared.chunks.map((chunk, index) => ({
        chunkIndex: chunk.chunkIndex,
        chunkText: chunk.chunkText,
        headingPath: chunk.headingPath,
        tokenCount: chunk.tokenCount,
        embedding: chunkEmbeddings[index]!,
      })),
    });
    return { model, status: "saved", chunkCount: prepared.chunks.length };
  };

  // one model failing (e.g. rate-limited past retries) must not block the
  // other models for this translation
  const settled = await Promise.allSettled(
    staleModels.map((model) => embedWithModel(model))
  );

  const models = staleModels.map((model, index): ModelResult => {
    const result = settled[index];
    if (result?.status === "fulfilled") {
      return result.value;
    }
    return {
      model,
      status: "failed",
      error: String(
        result?.status === "rejected" ? result.reason : "missing result"
      ),
    };
  });

  return { status: "processed", models };
};

// the canonical (OpenAI) model must succeed wherever it was stale
const embeddingsSucceeded = (result: EmbeddingsResult): boolean =>
  result.status === "skipped" ||
  (result.status === "processed" &&
    result.models.every(
      (model) =>
        model.model !== CANONICAL_EMBEDDING_MODEL || model.status === "saved"
    ));

/**
 * Durable indexing pipeline — the single entry point after a feed changes.
 * Loads one snapshot, then per translation runs reading time, Algolia, and
 * the embedding pipeline in parallel, all as steps of this one workflow.
 * Branches fail independently; each step retries on its own.
 */
export const feedIndexingWorkflow = async (request: Request) => {
  "use workflow";

  const { feedID } = requestSchema.parse(request);

  const feed = await loadFeedForIndexingStep(feedID);
  if (!feed) {
    return { success: false as const, error: "Feed not found" };
  }

  const indexTranslation = async (
    translation: FeedIndexingSnapshot["translations"][number]
  ) => {
    const indexableContent =
      translation.content ?? translation.description ?? "";

    const [readingTime, algolia, embeddings] = await Promise.allSettled([
      estimateReadingTimeStep(feedID, translation.locale, indexableContent),
      saveFeedToAlgoliaStep({
        feedID,
        objectID: translation.translationID,
        type: feed.type,
        locale: translation.locale,
        slug: feed.slug,
        title: translation.title,
        content: indexableContent,
        description: translation.description ?? "",
        createdAt: feed.createdAt,
        updatedAt: feed.updatedAt,
        enabled: feed.enabled,
      }),
      indexTranslationEmbeddings(feed.enabled, translation),
    ]);

    return {
      locale: translation.locale,
      readingTime: settledStatus(readingTime),
      algolia: settledStatus(algolia),
      embeddings:
        embeddings.status === "fulfilled"
          ? embeddings.value
          : ({
              status: "failed",
              error: String(embeddings.reason),
            } satisfies EmbeddingsResult),
    };
  };

  const translations = await Promise.all(
    feed.translations.map((translation) => indexTranslation(translation))
  );

  const success = translations.every(
    (translation) =>
      translation.readingTime === "ok" &&
      translation.algolia === "ok" &&
      embeddingsSucceeded(translation.embeddings)
  );

  console.log("Feed indexing workflow finished", {
    feedID,
    success,
    translations,
  });

  return { success, translations };
};
