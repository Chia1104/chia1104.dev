import { and, eq, inArray, sql } from "drizzle-orm";

import { chunkMarkdown } from "@chia/ai/embeddings/chunking";
import {
  buildEmbeddingInput,
  hashEmbeddingInput,
} from "@chia/ai/embeddings/utils";
import type { DB } from "@chia/db";
import { feeds, feedTranslations, RESOURCE_CHUNK_KIND } from "@chia/db/schema";
import type { Locale } from "@chia/db/types";

import type {
  ChunkableResource,
  ResourceChunkInput,
  ResourceChunkSet,
  ResourceSummary,
} from "./types";

export const FEED_TRANSLATION_SOURCE_TYPE = "feed_translation";

interface FeedTranslationSource {
  id: number;
  locale: Locale;
  title: string;
  excerpt: string | null;
  description: string | null;
  summary: string | null;
  content: string | null;
  published: boolean;
  deleted: boolean;
  tags: string[];
}

const loadSource = async (
  db: DB,
  sourceId: number
): Promise<FeedTranslationSource | null> => {
  const [row] = await db
    .select({
      id: feedTranslations.id,
      locale: feedTranslations.locale,
      title: feedTranslations.title,
      excerpt: feedTranslations.excerpt,
      description: feedTranslations.description,
      summary: feedTranslations.summary,
      content: feedTranslations.content,
      published: feeds.published,
      deleted: sql<boolean>`${feeds.deletedAt} is not null`,
      tags: sql<string[]>`coalesce((
        select array_agg(distinct tt.name)
        from chia_feeds_to_tags ft
        join chia_tag_translation tt
          on tt.tag_id = ft.tag_id and tt.locale = ${feedTranslations.locale}
        where ft.feed_id = ${feeds.id}
      ), '{}')`,
    })
    .from(feedTranslations)
    .innerJoin(feeds, eq(feeds.id, feedTranslations.feedId))
    .where(eq(feedTranslations.id, sourceId))
    .limit(1);

  return row ?? null;
};

const buildChunkSet = async (
  source: FeedTranslationSource
): Promise<ResourceChunkSet> => {
  const chunks: ResourceChunkInput[] = [];

  const card = buildEmbeddingInput({
    title: source.title,
    description: source.description,
    summary: source.summary,
    excerpt: source.excerpt,
    tags: source.tags,
    content: source.content,
  });
  if (card) {
    chunks.push({
      kind: RESOURCE_CHUNK_KIND.Card,
      chunkIndex: 0,
      content: card,
      contentHash: await hashEmbeddingInput(card),
    });
  }

  if (source.content) {
    for (const chunk of await chunkMarkdown({ content: source.content })) {
      chunks.push({
        kind: RESOURCE_CHUNK_KIND.Section,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        headingPath: chunk.headingPath,
        tokenCount: chunk.tokenCount,
        metadata:
          chunk.headingPaths.length > 1
            ? { headingPaths: chunk.headingPaths }
            : null,
        contentHash: await hashEmbeddingInput(chunk.content),
      });
    }
  }

  return {
    visibility: {
      locale: source.locale,
      published: source.published,
      deleted: source.deleted,
    },
    chunks,
  };
};

export const feedTranslationResource: ChunkableResource = {
  sourceType: FEED_TRANSLATION_SOURCE_TYPE,

  async buildChunks(db, sourceId) {
    const source = await loadSource(db, sourceId);
    return source ? await buildChunkSet(source) : null;
  },

  async hydrate(db, sourceIds) {
    if (sourceIds.length === 0) {
      return new Map();
    }

    const rows = await db
      .select({
        id: feedTranslations.id,
        locale: feedTranslations.locale,
        title: feedTranslations.title,
        description: feedTranslations.description,
        summary: feedTranslations.summary,
        excerpt: feedTranslations.excerpt,
        slug: feeds.slug,
        type: feeds.type,
      })
      .from(feedTranslations)
      .innerJoin(feeds, eq(feeds.id, feedTranslations.feedId))
      .where(
        and(
          inArray(feedTranslations.id, sourceIds),
          eq(feedTranslations.deleted, false)
        )
      );

    return new Map<number, ResourceSummary>(
      rows.map((row) => [
        row.id,
        {
          sourceType: FEED_TRANSLATION_SOURCE_TYPE,
          sourceId: row.id,
          title: row.title,
          description: row.summary ?? row.description ?? row.excerpt ?? null,
          href: `/${row.locale}/${row.type}/${row.slug}`,
          locale: row.locale,
        },
      ])
    );
  },
};
