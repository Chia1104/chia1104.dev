export const TaskID = {
  FeedSummarize: "feed-summarize",
} as const;

export type TaskID = (typeof TaskID)[keyof typeof TaskID];
