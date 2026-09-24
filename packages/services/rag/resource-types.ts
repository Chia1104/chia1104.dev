/**
 * Indexable resource types and search modes. Imports nothing, so sandboxed `"use workflow"`
 * functions and contracts can use them without bundling the adapters.
 */
export const ResourceType = {
  FeedTranslation: "feed_translation",
  AgentMemory: "agent_memory",
} as const;

export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

export const isResourceType = (
  sourceType: string
): sourceType is ResourceType =>
  Object.values(ResourceType).some((type) => type === sourceType);

/** `hybrid` fuses dense and BM25 by rank; the other two isolate one half. */
export const ResourceSearchMode = {
  Hybrid: "hybrid",
  Bm25: "bm25",
  Semantic: "semantic",
} as const;

export type ResourceSearchMode =
  (typeof ResourceSearchMode)[keyof typeof ResourceSearchMode];
