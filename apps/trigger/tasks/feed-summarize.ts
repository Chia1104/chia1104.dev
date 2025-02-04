import { schemaTask, metadata, logger } from "@trigger.dev/sdk/v3";
import OpenAI from "openai";
import { z } from "zod";

import { streamGeneratedText } from "@chia/ai/generate/utils";
import { baseRequestSchema } from "@chia/ai/types";
import { getFeedMetaById, insertFeedMeta } from "@chia/api/services/feeds";

import { TaskID } from "./tasks.constant";
import { env } from "./utils/env";

export type STREAMS = {
  openai: OpenAI.ChatCompletionChunk; // The type of the chunk is determined by the provider
};

const requestSchema = z.object({
  ...baseRequestSchema.omit({ authToken: true, messages: true }).shape,
  feedID: z.string(),
});

const SYSTEM_PROMPT =
  "請幫我總結這篇文章的內容，並依照這篇文章的語言生成，需要有助於 SEO 的內容，最後不可超過 300 字。";

export const feedSummarizeTask = schemaTask({
  id: TaskID.FeedSummarize,
  schema: requestSchema,
  run: async ({ modal, system, feedID }) => {
    const feedMeta = await getFeedMetaById(env.INTERNAL_REQUEST_SECRET, {
      id: feedID,
    });

    /**
     * TODO: handle data revalidation
     */
    if (feedMeta?.summary) {
      return;
    }

    const completion = streamGeneratedText({
      modal,
      authToken: env.OPENAI_API_KEY,
      messages: [
        {
          role: "user",
          content: `目前的文章內容為：
          ${feedMeta?.feed.content.source}
        `,
        },
      ],
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

    await insertFeedMeta(env.INTERNAL_REQUEST_SECRET, {
      feedId: Number(feedID),
      summary: text,
    });
  },
});
