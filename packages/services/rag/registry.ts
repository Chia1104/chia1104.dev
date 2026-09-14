import { agentMemoryResource } from "./agent-memory.resource";
import { feedTranslationResource } from "./feed-translation.resource";
import {
  AGENT_MEMORY_SOURCE_TYPE,
  FEED_TRANSLATION_SOURCE_TYPE,
} from "./resource-types";
import type { ResourceType } from "./resource-types";
import type { ChunkableResource } from "./types";

/**
 * The adapter for every type in `resourceTypes`; a type without one does not compile.
 * Indexing and search both resolve adapters here.
 */
const adapters = {
  [FEED_TRANSLATION_SOURCE_TYPE]: feedTranslationResource,
  [AGENT_MEMORY_SOURCE_TYPE]: agentMemoryResource,
} satisfies Record<ResourceType, ChunkableResource>;

// a Map, not the record: `sourceType` reaches here from a workflow request, and
// `adapters["toString"]` resolves to an inherited function that passes a truthiness check
const registry = new Map<string, ChunkableResource>(Object.entries(adapters));

export const getResourceAdapter = (sourceType: string): ChunkableResource => {
  const adapter = registry.get(sourceType);
  if (!adapter) {
    throw new Error(`No resource adapter registered for "${sourceType}"`);
  }
  return adapter;
};
