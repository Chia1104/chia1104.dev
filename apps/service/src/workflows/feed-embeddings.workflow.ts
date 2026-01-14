import * as z from "zod";

import { Locale } from "@chia/db/types";

import {
  upsertFeedTranslationStep,
  ollamaEmbeddingStep,
} from "../steps/feed-embeddings.step";

export const requestSchema = z.object({
  feedID: z.number(),
  content: z.string(),
  locale: z.enum(Locale).optional().default(Locale.zhTW),
  enabled: z.boolean().optional().default(true),
});

type Request = z.input<typeof requestSchema>;

export const feedEmbeddingsWorkflow = async (request: Request) => {
  "use workflow";

  const parsedRequest = requestSchema.parse(request);

  if (!parsedRequest.enabled) {
    console.log("Embedding generation is disabled, skipping", {
      feedID: parsedRequest.feedID,
    });
    return {
      success: true,
    };
  }

  if (!parsedRequest.content) {
    return {
      success: false,
      error: "No content provided",
    };
  }

  console.log("Generating embedding", {
    feedID: parsedRequest.feedID,
    locale: parsedRequest.locale,
    contentLength: parsedRequest.content.length,
  });

  const embedding = await ollamaEmbeddingStep(
    parsedRequest.content,
    "nomic-embed-text"
  );

  if (!embedding) {
    console.log("Failed to generate embedding", {
      feedID: parsedRequest.feedID,
      locale: parsedRequest.locale,
    });
    return;
  }

  await upsertFeedTranslationStep(
    parsedRequest.feedID,
    parsedRequest.locale,
    embedding
  );

  console.log("Successfully generated and saved embedding", {
    feedID: parsedRequest.feedID,
    locale: parsedRequest.locale,
  });

  return {
    success: true,
  };
};
