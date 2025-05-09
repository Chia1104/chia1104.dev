export const TaskID = {
  FeedSummarize: "feed-summarize",
  FeedEmbeddings: "feed-embeddings",
} as const;

export type TaskID = (typeof TaskID)[keyof typeof TaskID];
