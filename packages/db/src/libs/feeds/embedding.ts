import { sql, cosineDistance, desc, gt } from "drizzle-orm";

import type { OllamaEmbeddingModel } from "@chia/ai/embeddings/ollama";
import { ollamaEmbedding } from "@chia/ai/embeddings/ollama";
import { generateEmbedding } from "@chia/ai/embeddings/openai";
import type { Options } from "@chia/ai/embeddings/openai";
import { isOllamaEnabled } from "@chia/ai/ollama/utils";

import { withDTO } from "../";
import { schema } from "../..";

export const searchFeeds = withDTO(
  async (
    db,
    dto: Options & {
      input: string;
      limit?: number;
      comparison?: number;
      embedding?: number[];
      useOllama?: {
        model: OllamaEmbeddingModel;
      };
    }
  ) => {
    const embedding =
      dto.embedding ??
      (dto.useOllama
        ? (await isOllamaEnabled(dto.useOllama.model))
          ? await ollamaEmbedding(dto.input, dto.useOllama.model)
          : await generateEmbedding(dto.input, dto)
        : await generateEmbedding(dto.input, dto));
    const similarity = sql<number>`1 - (${cosineDistance(schema.feeds.embedding, embedding)})`;

    const feeds = await db
      .select({
        id: schema.feeds.id,
        userId: schema.feeds.userId,
        type: schema.feeds.type,
        slug: schema.feeds.slug,
        description: schema.feeds.description,
        createdAt: schema.feeds.createdAt,
        updatedAt: schema.feeds.updatedAt,
        readTime: schema.feeds.readTime,
        contentType: schema.feeds.contentType,
        published: schema.feeds.published,
        title: schema.feeds.title,
        excerpt: schema.feeds.excerpt,
        similarity,
      })
      .from(schema.feeds)
      .where(gt(similarity, dto.comparison ?? 0.5))
      .orderBy((t) => desc(t.similarity))
      .limit(dto.limit ?? 5);

    return {
      items: feeds,
      embedding,
    };
  }
);
