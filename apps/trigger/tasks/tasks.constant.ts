export const TaskID = {
  FeedSummarize: "feed-summarize",
  FeedEmbeddings: "feed-embeddings",
  ImageScaleDown: "image-scale-down",
} as const;

export type TaskID = (typeof TaskID)[keyof typeof TaskID];
