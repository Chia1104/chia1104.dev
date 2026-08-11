import {
  FEED_TRANSLATION_SOURCE_TYPE,
  feedTranslationResource,
} from "./feed-translation.resource";
import type { ChunkableResource } from "./types";

/**
 * Every indexable resource type. Register a new adapter here and both indexing
 * and search pick it up.
 */
const registry: Record<string, ChunkableResource> = {
  [FEED_TRANSLATION_SOURCE_TYPE]: feedTranslationResource,
};

export const resourceTypes = Object.keys(registry);

export const getResourceAdapter = (sourceType: string): ChunkableResource => {
  const adapter = registry[sourceType];
  if (!adapter) {
    throw new Error(`No resource adapter registered for "${sourceType}"`);
  }
  return adapter;
};

export { FEED_TRANSLATION_SOURCE_TYPE };
export type { ChunkableResource, ResourceSummary } from "./types";
