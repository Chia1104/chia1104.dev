import * as z from "zod";

import {
  CANONICAL_EMBEDDING_MODEL,
  INDEXED_EMBEDDING_MODELS,
} from "@chia/ai/embeddings/utils";
import type { EmbeddingModel } from "@chia/ai/embeddings/utils";

import {
  loadFeedForEmbeddingStep,
  prepareTranslationEmbeddingStep,
  resolveStaleModelsStep,
  generateFeedEmbeddingsStep,
  saveFeedEmbeddingsStep,
  deleteFeedEmbeddingsStep,
} from "../steps/feed-embeddings.step";

export const requestSchema = z.object({
  feedID: z.number(),
});

type Request = z.input<typeof requestSchema>;

interface ModelResult {
  model: EmbeddingModel;
  status: "saved" | "unavailable" | "failed";
  chunkCount?: number;
  error?: string;
}

/**
 * Durable embedding pipeline: loads the feed itself (re-runnable with just a
 * feedID), fans out per translation, and per translation fans out per model.
 * Each model embeds the document + all chunks in one batched provider call.
 * Steps retry independently; a failed model never blocks the others.
 */
export const feedEmbeddingsWorkflow = async (request: Request) => {
  "use workflow";

  const { feedID } = requestSchema.parse(request);

  const feed = await loadFeedForEmbeddingStep(feedID);
  if (!feed) {
    return { success: false, error: "Feed not found" };
  }
  if (!feed.enabled) {
    console.log("Feed is unpublished or deleted, skipping embeddings", {
      feedID,
    });
    return { success: true, skipped: true };
  }

  const translations = await Promise.all(
    feed.translations.map(async (translation) => {
      const prepared = await prepareTranslationEmbeddingStep(translation);
      if (!prepared.documentInput) {
        // content was emptied — remove stale vectors so search stops
        // matching this translation
        const { deletedCount } = await deleteFeedEmbeddingsStep(
          translation.translationID
        );
        return {
          locale: translation.locale,
          status: "skipped" as const,
          reason: "no content",
          deletedCount,
        };
      }

      const staleModels = await resolveStaleModelsStep(
        translation.translationID,
        prepared.contentHash,
        INDEXED_EMBEDDING_MODELS
      );
      if (staleModels.length === 0) {
        console.log("Embeddings are up to date, skipping", {
          feedID,
          locale: translation.locale,
        });
        return {
          locale: translation.locale,
          status: "skipped" as const,
          reason: "up to date",
        };
      }

      // one model failing (e.g. rate-limited past retries) must not block
      // the other models for this translation
      const inputs = [
        prepared.documentInput,
        ...prepared.chunks.map((chunk) => chunk.embeddingInput),
      ];
      const settled = await Promise.allSettled(
        staleModels.map(async (model): Promise<ModelResult> => {
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
        })
      );

      const models = settled.map((result, index): ModelResult => {
        if (result.status === "fulfilled") {
          return result.value;
        }
        return {
          model: staleModels[index]!,
          status: "failed",
          error: String(result.reason),
        };
      });

      return {
        locale: translation.locale,
        status: "processed" as const,
        models,
      };
    })
  );

  // the canonical (OpenAI) model must succeed wherever it was stale
  const success = translations.every(
    (translation) =>
      translation.status === "skipped" ||
      translation.models.every(
        (model) =>
          model.model !== CANONICAL_EMBEDDING_MODEL || model.status === "saved"
      )
  );

  console.log("Feed embeddings workflow finished", {
    feedID,
    success,
    translations,
  });

  return { success, translations };
};
