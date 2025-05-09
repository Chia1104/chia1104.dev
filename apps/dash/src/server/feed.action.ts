"use server";

// import {
//   feedEmbeddingsTask,
//   requestSchema as feedEmbeddingsRequestSchema,
// } from "trigger/feed-embeddings";
import { action } from "./action";

export const generateFeedEmbedding = action
  // .schema(feedEmbeddingsRequestSchema)
  .action(() => {
    // await feedEmbeddingsTask.trigger(parsedInput);
    throw new Error("Not implemented");
  });
