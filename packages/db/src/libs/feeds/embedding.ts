import {
  sql,
  cosineDistance,
  desc,
  gt,
  gte,
  eq,
  ne,
  and,
  or,
  isNotNull,
  isNull,
} from "drizzle-orm";

import { ollamaEmbedding } from "@chia/ai/embeddings/ollama";
import { generateEmbedding } from "@chia/ai/embeddings/openai";
import type { Options } from "@chia/ai/embeddings/openai";
import {
  CANONICAL_EMBEDDING_MODEL,
  EMBEDDING_MODEL_DIMENSIONS,
  getEmbeddingModelConfig,
} from "@chia/ai/embeddings/utils";
import type {
  EmbeddingModel,
  OllamaEmbeddingModel,
} from "@chia/ai/embeddings/utils";
import { isOllamaEnabled } from "@chia/ai/ollama/utils";

import { withDTO } from "../";
import type { Locale } from "../..";
import { schema } from "../..";

export type FeedEmbeddingKind = "document" | "chunk";

/**
 * Thrown when an Ollama model is explicitly requested but Ollama is
 * unreachable. Query-side code must fail loud instead of silently falling
 * back to another model — the cached query embedding and the reported
 * provider would no longer match the vectors actually searched.
 */
export class OllamaUnavailableError extends Error {
  constructor(readonly model: string) {
    super(`Ollama embedding model "${model}" is unavailable`);
    this.name = "OllamaUnavailableError";
  }
}

const embeddingColumnFor = (model: EmbeddingModel) =>
  EMBEDDING_MODEL_DIMENSIONS[model] === 512
    ? schema.feedEmbeddings.embedding512
    : schema.feedEmbeddings.embedding1536;

const vectorColumnsFor = (model: EmbeddingModel, embedding: number[]) => {
  const dimensions = EMBEDDING_MODEL_DIMENSIONS[model];
  if (embedding.length !== dimensions) {
    throw new Error(
      `Embedding for model "${model}" must have ${dimensions} dimensions, received ${embedding.length}`
    );
  }
  return dimensions === 512
    ? { embedding512: embedding, embedding1536: null }
    : { embedding1536: embedding, embedding512: null };
};

export const upsertFeedEmbedding = withDTO(
  async (
    db,
    dto: {
      feedTranslationId: number;
      model: EmbeddingModel;
      kind: FeedEmbeddingKind;
      contentHash: string;
      indexVersion: string;
      embedding: number[];
      chunkIndex?: number;
      chunkText?: string | null;
      headingPath?: string | null;
      tokenCount?: number | null;
    }
  ) => {
    const [row] = await db
      .insert(schema.feedEmbeddings)
      .values({
        feedTranslationId: dto.feedTranslationId,
        model: dto.model,
        kind: dto.kind,
        chunkIndex: dto.chunkIndex ?? 0,
        chunkText: dto.chunkText,
        headingPath: dto.headingPath,
        tokenCount: dto.tokenCount,
        contentHash: dto.contentHash,
        indexVersion: dto.indexVersion,
        ...vectorColumnsFor(dto.model, dto.embedding),
      })
      .onConflictDoUpdate({
        target: [
          schema.feedEmbeddings.feedTranslationId,
          schema.feedEmbeddings.model,
          schema.feedEmbeddings.kind,
          schema.feedEmbeddings.chunkIndex,
        ],
        set: {
          chunkText: dto.chunkText,
          headingPath: dto.headingPath,
          tokenCount: dto.tokenCount,
          contentHash: dto.contentHash,
          indexVersion: dto.indexVersion,
          ...vectorColumnsFor(dto.model, dto.embedding),
          updatedAt: new Date(),
        },
      })
      .returning({
        id: schema.feedEmbeddings.id,
        model: schema.feedEmbeddings.model,
        kind: schema.feedEmbeddings.kind,
      });

    return row;
  }
);

/**
 * Atomically replaces a translation's embeddings for one model: upserts the
 * document row and every chunk row, then removes orphan chunks (content got
 * shorter) and rows from older index versions.
 */
export const replaceFeedEmbeddings = withDTO(
  async (
    db,
    dto: {
      feedTranslationId: number;
      model: EmbeddingModel;
      contentHash: string;
      indexVersion: string;
      document: { embedding: number[] };
      chunks: {
        chunkIndex: number;
        chunkText: string;
        headingPath: string | null;
        tokenCount: number;
        embedding: number[];
      }[];
    }
  ) => {
    return await db.transaction(async (trx) => {
      const base = {
        feedTranslationId: dto.feedTranslationId,
        model: dto.model,
        contentHash: dto.contentHash,
        indexVersion: dto.indexVersion,
      };

      await upsertFeedEmbedding(trx, {
        ...base,
        kind: "document",
        chunkIndex: 0,
        embedding: dto.document.embedding,
      });

      for (const chunk of dto.chunks) {
        await upsertFeedEmbedding(trx, {
          ...base,
          kind: "chunk",
          chunkIndex: chunk.chunkIndex,
          chunkText: chunk.chunkText,
          headingPath: chunk.headingPath,
          tokenCount: chunk.tokenCount,
          embedding: chunk.embedding,
        });
      }

      // drop orphan chunks and rows from older index versions
      await trx
        .delete(schema.feedEmbeddings)
        .where(
          and(
            eq(schema.feedEmbeddings.feedTranslationId, dto.feedTranslationId),
            eq(schema.feedEmbeddings.model, dto.model),
            or(
              ne(schema.feedEmbeddings.indexVersion, dto.indexVersion),
              and(
                eq(schema.feedEmbeddings.kind, "chunk"),
                gte(schema.feedEmbeddings.chunkIndex, dto.chunks.length)
              )
            )
          )
        );

      return { chunkCount: dto.chunks.length };
    });
  }
);

/**
 * Removes every embedding for a translation — used when a translation no
 * longer has embeddable content, so stale vectors can't keep matching it.
 */
export const deleteFeedEmbeddings = withDTO(
  async (db, dto: { feedTranslationId: number }) => {
    const deleted = await db
      .delete(schema.feedEmbeddings)
      .where(eq(schema.feedEmbeddings.feedTranslationId, dto.feedTranslationId))
      .returning({ id: schema.feedEmbeddings.id });
    return { deletedCount: deleted.length };
  }
);

/**
 * Lightweight metadata (no vectors) for stale detection — one row per model,
 * taken from the document row which is always written last with its chunks.
 */
export const getFeedEmbeddingMeta = withDTO(
  async (db, dto: { feedTranslationId: number }) => {
    return await db
      .select({
        model: schema.feedEmbeddings.model,
        contentHash: schema.feedEmbeddings.contentHash,
        indexVersion: schema.feedEmbeddings.indexVersion,
        updatedAt: schema.feedEmbeddings.updatedAt,
      })
      .from(schema.feedEmbeddings)
      .where(
        and(
          eq(schema.feedEmbeddings.feedTranslationId, dto.feedTranslationId),
          eq(schema.feedEmbeddings.kind, "document")
        )
      );
  }
);

export const searchFeeds = withDTO(
  async (
    db,
    {
      useOllama,
      ...dto
    }: Options & {
      input: string;
      limit?: number;
      /** how many chunk candidates to fetch before aggregating by feed */
      candidateLimit?: number;
      comparison?: number;
      embedding?: number[];
      useOllama?: {
        model: OllamaEmbeddingModel;
      };
      locale?: Locale;
      enableDeleted?: boolean;
    }
  ) => {
    if (useOllama && !(await isOllamaEnabled(useOllama.model))) {
      throw new OllamaUnavailableError(useOllama.model);
    }
    const model: EmbeddingModel = useOllama
      ? useOllama.model
      : (dto.model ?? CANONICAL_EMBEDDING_MODEL);
    const embeddingColumn = embeddingColumnFor(model);
    const embedding =
      dto.embedding ??
      (useOllama
        ? await ollamaEmbedding(dto.input, useOllama.model, "search_query")
        : await generateEmbedding(dto.input, dto));
    if (!embedding?.length) {
      return {
        items: [],
        embedding: [],
      };
    }
    // guards against e.g. a stale cached query embedding from another model
    if (embedding.length !== EMBEDDING_MODEL_DIMENSIONS[model]) {
      throw new Error(
        `Query embedding for "${model}" must have ${EMBEDDING_MODEL_DIMENSIONS[model]} dimensions, received ${embedding.length}`
      );
    }

    const similarity = sql<number>`1 - (${cosineDistance(
      embeddingColumn,
      embedding
    )})`;
    const threshold =
      dto.comparison ?? getEmbeddingModelConfig(model).defaultThreshold;
    const limit = dto.limit ?? 5;

    // fetch top chunk/document candidates via HNSW, then aggregate per feed
    // in code so a single article cannot fill the whole result list
    const candidates = await db
      .select({
        id: schema.feeds.id,
        userId: schema.feeds.userId,
        type: schema.feeds.type,
        slug: schema.feeds.slug,
        contentType: schema.feeds.contentType,
        published: schema.feeds.published,
        defaultLocale: schema.feeds.defaultLocale,
        mainImage: schema.feeds.mainImage,
        createdAt: schema.feeds.createdAt,
        updatedAt: schema.feeds.updatedAt,
        feedTranslationId: schema.feedTranslations.id,
        locale: schema.feedTranslations.locale,
        title: schema.feedTranslations.title,
        excerpt: schema.feedTranslations.excerpt,
        description: schema.feedTranslations.description,
        summary: schema.feedTranslations.summary,
        readTime: schema.feedTranslations.readTime,
        // best-matching section for citation / preview
        kind: schema.feedEmbeddings.kind,
        chunkIndex: schema.feedEmbeddings.chunkIndex,
        chunkText: schema.feedEmbeddings.chunkText,
        headingPath: schema.feedEmbeddings.headingPath,
        // 相似度分數
        similarity,
      })
      .from(schema.feeds)
      .innerJoin(
        schema.feedTranslations,
        eq(schema.feeds.id, schema.feedTranslations.feedId)
      )
      .innerJoin(
        schema.feedEmbeddings,
        and(
          eq(
            schema.feedEmbeddings.feedTranslationId,
            schema.feedTranslations.id
          ),
          eq(schema.feedEmbeddings.model, model)
        )
      )
      .where(
        and(
          dto.enableDeleted ? undefined : isNull(schema.feeds.deletedAt),
          eq(schema.feeds.published, true),
          isNotNull(embeddingColumn),
          gt(similarity, threshold),
          dto.locale
            ? eq(schema.feedTranslations.locale, dto.locale)
            : undefined
        )
      )
      .orderBy((t) => desc(t.similarity))
      .limit(dto.candidateLimit ?? Math.max(limit * 6, 30));

    // keep the best-scoring row per feed, preserving similarity order
    const bestByFeed = new Map<number, (typeof candidates)[number]>();
    for (const candidate of candidates) {
      if (!bestByFeed.has(candidate.id)) {
        bestByFeed.set(candidate.id, candidate);
      }
    }
    const items = [...bestByFeed.values()].slice(0, limit);

    return {
      items,
      embedding,
    };
  }
);

export const getRelatedFeeds = withDTO(
  async (
    db,
    dto: {
      slug: string;
      locale: Locale;
      limit?: number;
      comparison?: number;
    }
  ) => {
    const embeddingColumn = embeddingColumnFor(CANONICAL_EMBEDDING_MODEL);
    // related feeds compare topic-level document vectors, never chunks
    const embeddingJoin = and(
      eq(schema.feedEmbeddings.feedTranslationId, schema.feedTranslations.id),
      eq(schema.feedEmbeddings.model, CANONICAL_EMBEDDING_MODEL),
      eq(schema.feedEmbeddings.kind, "document")
    );

    const [source] = await db
      .select({
        id: schema.feeds.id,
        embedding: embeddingColumn,
      })
      .from(schema.feeds)
      .innerJoin(
        schema.feedTranslations,
        eq(schema.feeds.id, schema.feedTranslations.feedId)
      )
      .innerJoin(schema.feedEmbeddings, embeddingJoin)
      .where(
        and(
          eq(schema.feeds.slug, dto.slug),
          eq(schema.feeds.published, true),
          isNull(schema.feeds.deletedAt),
          eq(schema.feedTranslations.locale, dto.locale),
          isNotNull(embeddingColumn)
        )
      )
      .limit(1);

    if (!source?.embedding) {
      return [];
    }

    const similarity = sql<number>`1 - (${cosineDistance(
      embeddingColumn,
      source.embedding
    )})`;
    const threshold =
      dto.comparison ??
      getEmbeddingModelConfig(CANONICAL_EMBEDDING_MODEL).defaultThreshold;

    return await db
      .select({
        id: schema.feeds.id,
        type: schema.feeds.type,
        slug: schema.feeds.slug,
        locale: schema.feedTranslations.locale,
        title: schema.feedTranslations.title,
        description: schema.feedTranslations.description,
        excerpt: schema.feedTranslations.excerpt,
        createdAt: schema.feeds.createdAt,
        similarity,
      })
      .from(schema.feeds)
      .innerJoin(
        schema.feedTranslations,
        eq(schema.feeds.id, schema.feedTranslations.feedId)
      )
      .innerJoin(schema.feedEmbeddings, embeddingJoin)
      .where(
        and(
          ne(schema.feeds.id, source.id),
          eq(schema.feeds.published, true),
          isNull(schema.feeds.deletedAt),
          eq(schema.feedTranslations.locale, dto.locale),
          isNotNull(embeddingColumn),
          gt(similarity, threshold)
        )
      )
      .orderBy(desc(similarity))
      .limit(dto.limit ?? 3);
  }
);
