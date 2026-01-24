import { sql, cosineDistance, desc, gt, eq, and, isNotNull } from "drizzle-orm";

import type { OllamaEmbeddingModel } from "@chia/ai/embeddings/ollama";
import { ollamaEmbedding } from "@chia/ai/embeddings/ollama";
import { generateEmbedding } from "@chia/ai/embeddings/openai";
import type { Options } from "@chia/ai/embeddings/openai";
import { isOllamaEnabled } from "@chia/ai/ollama/utils";

import { withDTO } from "../";
import type { Locale } from "../..";
import { schema } from "../..";

export const searchFeeds = withDTO(
  async (
    db,
    {
      useOllama,
      ...dto
    }: Options & {
      input: string;
      limit?: number;
      comparison?: number;
      embedding?: number[];
      useOllama?: {
        model: OllamaEmbeddingModel;
      };
      locale?: Locale;
    }
  ) => {
    const isOllama = useOllama && (await isOllamaEnabled(useOllama.model));
    const embedding = isOllama
      ? await ollamaEmbedding(dto.input, useOllama.model)
      : await generateEmbedding(dto.input, dto);
    if (!embedding) {
      return {
        items: [],
        embedding: [],
      };
    }

    const similarity = sql<number>`1 - (${cosineDistance(
      isOllama
        ? schema.feedTranslations.embedding512
        : schema.feedTranslations.embedding,
      embedding
    )})`;

    const feeds = await db
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
        // 相似度分數
        similarity,
      })
      .from(schema.feeds)
      .innerJoin(
        schema.feedTranslations,
        eq(schema.feeds.id, schema.feedTranslations.feedId)
      )
      .where(
        and(
          isNotNull(
            isOllama
              ? schema.feedTranslations.embedding512
              : schema.feedTranslations.embedding
          ),
          gt(similarity, dto.comparison ?? 0.5),
          dto.locale
            ? eq(schema.feedTranslations.locale, dto.locale)
            : undefined
        )
      )
      .orderBy((t) => desc(t.similarity))
      .limit(dto.limit ?? 5);

    return {
      items: feeds,
      embedding,
    };
  }
);
