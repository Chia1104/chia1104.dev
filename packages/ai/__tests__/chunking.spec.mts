import { describe, expect, it } from "vitest";

import {
  chunkMarkdownForEmbedding,
  cleanMdxKeepStructure,
  countEmbeddingTokens,
} from "../src/embeddings/chunking";
import {
  CANONICAL_EMBEDDING_MODEL,
  EMBEDDING_MODEL_REGISTRY,
  INDEXED_EMBEDDING_MODELS,
  QUERYABLE_EMBEDDING_MODELS,
  isQueryableEmbeddingModel,
  normalizeQueryForEmbedding,
} from "../src/embeddings/utils";

const ARTICLE = `
import { Chart } from "@/components/chart";

# pgvector 使用筆記

前言段落,介紹 pgvector。

## 安裝

\`\`\`bash
brew install pgvector
\`\`\`

## HNSW

### ef_search 調校

調高 ef_search 可以提升 recall。

<Chart data={data} />
`;

describe("cleanMdxKeepStructure", () => {
  it("keeps code blocks and headings, strips imports and JSX", () => {
    const cleaned = cleanMdxKeepStructure(ARTICLE);
    expect(cleaned).toContain("brew install pgvector");
    expect(cleaned).toContain("## HNSW");
    expect(cleaned).not.toContain("import { Chart }");
    expect(cleaned).not.toContain("<Chart");
  });

  it("condenses long code blocks but keeps the head", () => {
    const longCode =
      "```ts\n" +
      Array.from({ length: 60 }, (_, i) => `const line${i} = ${i};`).join(
        "\n"
      ) +
      "\n```";
    const cleaned = cleanMdxKeepStructure(longCode);
    expect(cleaned).toContain("const line0 = 0;");
    expect(cleaned).toContain("…");
    expect(cleaned).not.toContain("const line59");
  });
});

describe("chunkMarkdownForEmbedding", () => {
  it("tracks heading paths and injects title into the embedding input", async () => {
    const chunks = await chunkMarkdownForEmbedding({
      title: "pgvector 使用筆記",
      content: ARTICLE,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    const efSearchChunk = chunks.find((chunk) =>
      chunk.chunkText.includes("ef_search 可以提升")
    );
    expect(efSearchChunk?.headingPath).toBe(
      "pgvector 使用筆記 > HNSW > ef_search 調校"
    );
    expect(efSearchChunk?.embeddingInput).toContain("Title: pgvector 使用筆記");
    expect(efSearchChunk?.embeddingInput).toContain("Section:");
    expect(efSearchChunk?.tokenCount).toBeGreaterThan(0);
  });

  it("splits oversized sections and keeps chunk indexes contiguous", async () => {
    const longSection = `# Long\n\n${"這是一段夠長的中文內容,用來測試切分。".repeat(400)}`;
    const chunks = await chunkMarkdownForEmbedding({
      title: "long",
      content: longSection,
      chunkTokens: 128,
      overlapTokens: 16,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(
      chunks.map((_, index) => index)
    );
    for (const chunk of chunks) {
      // overlap can push slightly past the target, never wildly
      expect(chunk.tokenCount).toBeLessThanOrEqual(160);
    }
  });

  it("does not split inside a code fence when treating headings", async () => {
    const content = `# T\n\n\`\`\`md\n# not a heading\n\`\`\`\n\ntail`;
    const chunks = await chunkMarkdownForEmbedding({ title: "t", content });
    expect(
      chunks.some((chunk) => chunk.headingPath?.includes("not a heading"))
    ).toBe(false);
  });
});

describe("countEmbeddingTokens", () => {
  it("counts tokens with cl100k_base", () => {
    expect(countEmbeddingTokens("hello world")).toBe(2);
    expect(countEmbeddingTokens("")).toBe(0);
  });
});

describe("embedding model registry", () => {
  it("has exactly one canonical model, and it is indexed", () => {
    const canonical = Object.values(EMBEDDING_MODEL_REGISTRY).filter(
      (config) => config.canonical
    );
    expect(canonical).toHaveLength(1);
    expect(canonical[0]?.indexed).toBe(true);
    expect(CANONICAL_EMBEDDING_MODEL).toBe(canonical[0]?.model);
  });

  it("only offers indexed models for querying", () => {
    for (const model of QUERYABLE_EMBEDDING_MODELS) {
      expect(INDEXED_EMBEDDING_MODELS).toContain(model);
    }
    expect(isQueryableEmbeddingModel("text-embedding-3-large")).toBe(false);
    expect(isQueryableEmbeddingModel("text-embedding-3-small")).toBe(true);
    expect(isQueryableEmbeddingModel("algolia")).toBe(false);
  });
});

describe("normalizeQueryForEmbedding", () => {
  it("collapses whitespace and lowercases but keeps punctuation", () => {
    expect(normalizeQueryForEmbedding("  PG   Vector  ")).toBe("pg vector");
    expect(normalizeQueryForEmbedding("pg-vector")).toBe("pg-vector");
    // distinct queries stay distinct (the old snakeCase key collapsed these)
    expect(normalizeQueryForEmbedding("pg-vector")).not.toBe(
      normalizeQueryForEmbedding("pg vector")
    );
  });
});
