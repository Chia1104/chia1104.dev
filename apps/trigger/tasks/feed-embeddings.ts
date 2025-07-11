import { schemaTask } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { generateEmbedding } from "@chia/ai/embeddings/openai";
import { getFeedById, updateFeed } from "@chia/api/services/feeds";

import { TaskID } from "./tasks.constant";
import { env } from "./utils/env";

export const requestSchema = z.object({
  feedID: z.string(),
});

export const feedEmbeddingsTask = schemaTask({
  id: TaskID.FeedEmbeddings,
  schema: requestSchema,
  run: async ({ feedID }) => {
    const feed = await getFeedById(
      {
        cfBypassToken: env.CF_BYPASS_TOKEN,
        apiKey: env.CH_API_KEY,
      },
      {
        id: feedID,
      }
    );

    if (!feed?.published) {
      return;
    }

    const embedding = await generateEmbedding(feed.content.source ?? "");

    if (!embedding) {
      throw new Error("Failed to generate embedding");
    }

    await updateFeed(
      {
        cfBypassToken: env.CF_BYPASS_TOKEN,
        apiKey: env.CH_API_KEY,
      },
      { id: Number(feedID), embedding }
    );
  },
});
