import { schemaTask, logger } from "@trigger.dev/sdk/v3";
import * as z from "zod";

import { generateEmbedding } from "@chia/ai/embeddings/openai";
import { getFeedById, upsertFeedTranslation } from "@chia/api/services/feeds";

import { TaskID } from "./tasks.constant";
import { env } from "./utils/env";

type Locale = "zh-TW" | "en";

export const requestSchema = z.object({
  feedID: z.string(),
  locale: z.string().optional(),
});

export const feedEmbeddingsTask = schemaTask({
  id: TaskID.FeedEmbeddings,
  schema: requestSchema,
  run: async ({ feedID, locale }) => {
    const targetLocale = (locale ?? "zh-TW") as Locale;

    const feed = await getFeedById(
      {
        cfBypassToken: env.CF_BYPASS_TOKEN,
        apiKey: env.CH_API_KEY,
      },
      {
        id: feedID,
        locale: targetLocale,
      }
    );

    if (!feed?.published) {
      logger.warn("Feed is not published, skipping embedding generation", {
        feedID,
      });
      return;
    }

    // Get the translation for the specified locale
    const translation = feed.translations.find(
      (t) => t.locale === targetLocale
    );

    if (!translation) {
      logger.error("Translation not found for locale", {
        locale: targetLocale,
      });
      return;
    }

    // Skip if embedding already exists
    if (translation.embedding) {
      logger.info("Embedding already exists, skipping", {
        feedID,
        locale: targetLocale,
      });
      return;
    }

    // Get content from translation
    const content =
      translation.content?.source ??
      translation.content?.content ??
      translation.description ??
      translation.title ??
      "";

    if (!content) {
      logger.error("No content found for translation", {
        feedID,
        locale: targetLocale,
      });
      return;
    }

    logger.info("Generating embedding", {
      feedID,
      locale: targetLocale,
      contentLength: content.length,
    });

    const embedding = await generateEmbedding(content);

    if (!embedding) {
      throw new Error("Failed to generate embedding");
    }

    // Update feed translation with the generated embedding
    await upsertFeedTranslation(
      {
        cfBypassToken: env.CF_BYPASS_TOKEN,
        apiKey: env.CH_API_KEY,
      },
      {
        feedId: Number(feedID),
        locale: targetLocale,
        title: translation.title, // Required field, use existing title
        description: translation.description,
        excerpt: translation.excerpt,
        summary: translation.summary,
        readTime: translation.readTime,
        embedding,
      }
    );

    logger.info("Successfully generated and saved embedding", {
      feedID,
      locale: targetLocale,
      embeddingDimensions: embedding.length,
    });
  },
});
