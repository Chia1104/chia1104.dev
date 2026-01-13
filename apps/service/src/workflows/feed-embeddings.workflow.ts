import * as z from "zod";

import { generateEmbedding } from "@chia/ai/embeddings/openai";
import { upsertFeedTranslation, getFeedById } from "@chia/db/repos/feeds";
import { Locale } from "@chia/db/types";

import { connectDatabaseStep } from "../steps/connect-database.step";

export const requestSchema = z.object({
  feedID: z.number(),
  locale: z.enum(Locale).optional().default(Locale.zhTW),
});

type Request = z.input<typeof requestSchema>;

export const feedEmbeddingsWorkflow = async (request: Request) => {
  "use workflow";

  const parsedRequest = requestSchema.parse(request);

  const db = await connectDatabaseStep();

  const feed = await getFeedById(db, {
    feedId: parsedRequest.feedID,
  });

  if (!feed) {
    throw new Error("Feed not found");
  }

  if (!feed.published) {
    console.log("Feed is not published, skipping embedding generation", {
      feedID: parsedRequest.feedID,
    });
    return;
  }

  const translation = feed.translations.find(
    (t) => t.locale === parsedRequest.locale
  );

  if (!translation) {
    console.log("Translation not found for locale", {
      locale: parsedRequest.locale,
    });
    return;
  }

  if (translation.embedding) {
    console.log("Embedding already exists, skipping", {
      feedID: parsedRequest.feedID,
      locale: parsedRequest.locale,
    });
    return;
  }

  const content =
    translation.content?.source ??
    translation.content?.content ??
    translation.description ??
    translation.title ??
    "";

  if (!content) {
    console.log("No content found for translation", {
      feedID: parsedRequest.feedID,
      locale: parsedRequest.locale,
    });
    return;
  }

  console.log("Generating embedding", {
    feedID: parsedRequest.feedID,
    locale: parsedRequest.locale,
    contentLength: content.length,
  });

  const embedding = await generateEmbedding(content);

  if (!embedding) {
    console.log("Failed to generate embedding", {
      feedID: parsedRequest.feedID,
      locale: parsedRequest.locale,
    });
    return;
  }

  await upsertFeedTranslation(db, {
    feedId: parsedRequest.feedID,
    locale: parsedRequest.locale,
    embedding,
  });

  console.log("Successfully generated and saved embedding", {
    feedID: parsedRequest.feedID,
    locale: parsedRequest.locale,
  });

  return {
    success: true,
  };
};
