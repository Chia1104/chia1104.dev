import { schemaTask, metadata, logger } from "@trigger.dev/sdk/v3";
import type OpenAI from "openai";
import * as z from "zod";

import { streamGeneratedText } from "@chia/ai/generate/utils";
import { baseRequestSchema } from "@chia/ai/types";
import { upsertFeedTranslation, getFeedById } from "@chia/api/services/feeds";

import { TaskID } from "./tasks.constant";
import { env } from "./utils/env";

type Locale = "zh-TW" | "en";

export type STREAMS = {
  openai: OpenAI.ChatCompletionChunk; // The type of the chunk is determined by the provider
};

export const requestSchema = z.object({
  ...baseRequestSchema.omit({ authToken: true, messages: true }).shape,
  feedID: z.string(),
  locale: z.string().optional(),
});

const SYSTEM_PROMPT =
  "請幫我總結這篇文章的內容，並依照這篇文章的語言生成，需要有助於 SEO 的內容，最後不可超過 250 字。";

export const feedSummarizeTask = schemaTask({
  id: TaskID.FeedSummarize,
  schema: requestSchema,
  run: async ({ model, system, feedID, locale }) => {
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

    // Skip if summary already exists
    if (translation.summary) {
      logger.info("Summary already exists, skipping", {
        feedID,
        locale: targetLocale,
      });
      return;
    }

    // Get content from translation
    const content =
      translation.content?.source ?? translation.content?.content ?? "";

    if (!content) {
      logger.error("No content found for translation", {
        feedID,
        locale: targetLocale,
      });
      return;
    }

    const completion = streamGeneratedText({
      model,
      authToken: env.OPENAI_API_KEY,
      messages: [
        {
          role: "user",
          content: `目前的文章內容為：
          ${content}
        `,
        },
      ],
      system: system ?? SYSTEM_PROMPT,
    });

    const stream = await metadata.stream(
      `${TaskID.FeedSummarize}-${feedID}-${targetLocale}`,
      completion.textStream
    );

    let text = "";

    for await (const chunk of stream) {
      logger.log("Received chunk", { chunk });
      text += chunk;
    }

    // Update feed translation with the generated summary
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
        readTime: translation.readTime,
        summary: text,
      }
    );

    logger.info("Successfully generated and saved summary", {
      feedID,
      locale: targetLocale,
      summaryLength: text.length,
    });
  },
});
