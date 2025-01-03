import { schemaTask, metadata, logger } from "@trigger.dev/sdk/v3";
import OpenAI from "openai";
import { z } from "zod";

import { streamGeneratedText } from "@chia/ai/generate/utils";
import { baseRequestSchema } from "@chia/ai/types";

import { TaskID } from "./tasks.constant";

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
    const completion = streamGeneratedText({
      modal,
      authToken: process.env.OPENAI_API_KEY ?? "",
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
