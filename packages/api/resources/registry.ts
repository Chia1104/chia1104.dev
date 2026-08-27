import {
  AGENT_MEMORY_SOURCE_TYPE,
  agentMemoryResource,
} from "./agent-memory.resource";
import {
  FEED_TRANSLATION_SOURCE_TYPE,
  feedTranslationResource,
} from "./feed-translation.resource";
import type { ChunkableResource } from "./types";

/**
 * Every indexable resource type. Register a new adapter here and both indexing
 * and search pick it up.
 */
const registry = new Map<string, ChunkableResource>([
  [FEED_TRANSLATION_SOURCE_TYPE, feedTranslationResource],
  [AGENT_MEMORY_SOURCE_TYPE, agentMemoryResource],
]);

export const resourceTypes = [...registry.keys()];

/** Whether a caller-supplied string names a registered adapter. */
export const isResourceType = (sourceType: string): boolean =>
  registry.has(sourceType);

export const getResourceAdapter = (sourceType: string): ChunkableResource => {
  // a Map, not an object literal: `sourceType` reaches here straight from a
  // workflow request, and `registry["toString"]` on a plain object resolves to
  // an inherited function that passes a truthiness check
  const adapter = registry.get(sourceType);
  if (!adapter) {
    throw new Error(`No resource adapter registered for "${sourceType}"`);
  }
  return adapter;
};

export { AGENT_MEMORY_SOURCE_TYPE, FEED_TRANSLATION_SOURCE_TYPE };
export type { ChunkableResource, ResourceSummary } from "./types";
