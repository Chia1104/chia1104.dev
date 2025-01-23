import { schemaTask, metadata, logger } from "@trigger.dev/sdk/v3";
import OpenAI from "openai";
import { z } from "zod";

import { streamGeneratedText } from "@chia/ai/generate/utils";
import { baseRequestSchema } from "@chia/ai/types";
import { getFeedMetaById } from "@chia/api/services/feeds";

import { TaskID } from "./tasks.constant";
import { env } from "./utils/env";

export type STREAMS = {
  openai: OpenAI.ChatCompletionChunk; // The type of the chunk is determined by the provider
};

const requestSchema = z.object({
  ...baseRequestSchema.omit({ authToken: true }).shape,
  feedID: z.string(),
});

const SYSTEM_PROMPT = "Summarize the feed";

export const feedSummarizeTask = schemaTask({
  id: TaskID.FeedSummarize,
  schema: requestSchema,
  run: async ({ modal, messages, system, feedID }) => {
    const feedMeta = await getFeedMetaById(env.INTERNAL_REQUEST_SECRET, {
      id: feedID,
    });

    /**
     * TODO: handle data revalidation
     */
    if (feedMeta) {
      return;
    }

    const completion = streamGeneratedText({
      modal,
      authToken: env.OPENAI_API_KEY,
      messages,
      system: system ?? SYSTEM_PROMPT,
    });

    const stream = await metadata.stream(
      `${TaskID.FeedSummarize}-${feedID}`,
      completion.textStream
    );

    let text = "";

    for await (const chunk of stream) {
      logger.log("Received chunk", { chunk });
      text += chunk;
    }

    return { text };
  },
});
