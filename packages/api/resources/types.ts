import type { DB } from "@chia/db/client";
import type {
  ResourceChunkInput,
  ResourceRef,
  ResourceVisibility,
} from "@chia/db/repos/resources/chunk";

/** Summary a search hit is rendered as, whatever the resource type. */
export interface ResourceSummary {
  sourceType: string;
  sourceId: number;
  title: string;
  description: string | null;
  /** deep-linkable path on the site, when the resource has one */
  href: string | null;
  locale: string | null;
}

export interface ResourceChunkSet {
  visibility: ResourceVisibility;
  /** The card plus one entry per section. */
  chunks: ResourceChunkInput[];
}

/**
 * Adding a type means implementing this and registering it; indexing and search stay
 * unchanged. The source's own shape does not appear here — it would force the registry
 * to be generic.
 */
export interface ChunkableResource {
  readonly sourceType: string;
  /** Resolves to null when the source no longer exists. */
  buildChunks(db: DB, sourceId: number): Promise<ResourceChunkSet | null>;
  hydrate(db: DB, sourceIds: number[]): Promise<Map<number, ResourceSummary>>;
}

export type { ResourceChunkInput, ResourceRef, ResourceVisibility };
