/**
 * Indexable resource types. Imports nothing, so sandboxed `"use workflow"` functions can
 * validate against them without bundling the adapters.
 */
export const FEED_TRANSLATION_SOURCE_TYPE = "feed_translation";
export const AGENT_MEMORY_SOURCE_TYPE = "agent_memory";

export const resourceTypes = [
  FEED_TRANSLATION_SOURCE_TYPE,
  AGENT_MEMORY_SOURCE_TYPE,
] as const;

export type ResourceType = (typeof resourceTypes)[number];

export const isResourceType = (
  sourceType: string
): sourceType is ResourceType =>
  resourceTypes.some((type) => type === sourceType);
