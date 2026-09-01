import { getEncoding } from "js-tiktoken";
import { describe, expect, it } from "vitest";

import {
  chunkMarkdown,
  SECTION_CHUNK_TOKENS,
} from "../src/embeddings/chunking";
import {
  buildHeadingOutline,
  extractHeadings,
} from "../src/embeddings/markdown";
import { buildEmbeddingInput } from "../src/embeddings/utils";

const encoding = getEncoding("cl100k_base");
const tokens = (text: string) => encoding.encode(text).length;

const ARTICLE = `
import Banner from "@/components/banner";

# 向量搜尋與嵌入技術

前言段落。

## 什麼是 embedding

內文。

### 維度取捨

內文。

## HNSW 調校

\`\`\`sql
SET hnsw.ef_search = 100;
-- # this is not a heading
\`\`\`

內文。

#### 太深的標題

不該出現在 outline。
`;

describe("extractHeadings", () => {
  it("tracks ancestor paths and ignores headings inside code fences", async () => {
    const headings = await extractHeadings(ARTICLE);
    expect(headings.map((heading) => heading.path)).toEqual([
      "向量搜尋與嵌入技術",
      "向量搜尋與嵌入技術 > 什麼是 embedding",
      "向量搜尋與嵌入技術 > 什麼是 embedding > 維度取捨",
      "向量搜尋與嵌入技術 > HNSW 調校",
      "向量搜尋與嵌入技術 > HNSW 調校 > 太深的標題",
    ]);
  });
});

describe("buildHeadingOutline", () => {
  it("indents relative to the shallowest kept level and honours maxDepth", async () => {
    expect(await buildHeadingOutline(ARTICLE)).toBe(
      [
        "- 向量搜尋與嵌入技術",
        "  - 什麼是 embedding",
        "    - 維度取捨",
        "  - HNSW 調校",
      ].join("\n")
    );
  });

  it("returns empty for content without headings", async () => {
    expect(await buildHeadingOutline("just a paragraph")).toBe("");
  });

  it("keeps tag-shaped heading text escaped", async () => {
    expect(await buildHeadingOutline("# \\<script>alert(1)\\</script>")).toBe(
      "- \\<script>alert(1)\\</script>"
    );
  });
});

describe("buildEmbeddingInput (document card)", () => {
  it("builds a card from title, summary, tags and outline", async () => {
    const card = await buildEmbeddingInput({
      title: "向量搜尋",
      summary: "介紹 pgvector 與 HNSW。",
      tags: ["postgres", "rag"],
      content: ARTICLE,
    });
    expect(card).toContain("Title: 向量搜尋");
    expect(card).toContain("Summary: 介紹 pgvector 與 HNSW。");
    expect(card).toContain("Tags: postgres, rag");
    expect(card).toContain("Outline:\n- 向量搜尋與嵌入技術");
  });

  it("does not embed the body when a summary and outline exist", async () => {
    const card = await buildEmbeddingInput({
      title: "向量搜尋",
      summary: "介紹 pgvector 與 HNSW。",
      content: ARTICLE,
    });
    expect(card).not.toContain("不該出現在 outline");
    expect(card).not.toContain("前言段落");
  });

  it("stays bounded no matter how long the article is", async () => {
    // 500 copies of the body under the same outline: the card must not grow
    const long = ARTICLE + "\n\n" + "很長的內文段落。".repeat(5000);
    const card = await buildEmbeddingInput({
      title: "向量搜尋",
      summary: "介紹 pgvector 與 HNSW。",
      content: long,
    });
    expect(tokens(card)).toBeLessThan(500);
  });

  it("falls back through summary → description → excerpt", async () => {
    expect(
      await buildEmbeddingInput({
        title: "t",
        description: "desc",
        content: ARTICLE,
      })
    ).toContain("Summary: desc");
    expect(
      await buildEmbeddingInput({
        title: "t",
        excerpt: "exc",
        content: ARTICLE,
      })
    ).toContain("Summary: exc");
  });

  it("uses a bounded body excerpt only when there is no summary and no outline", async () => {
    const card = await buildEmbeddingInput({
      title: "t",
      content: "沒有標題的純文字內容。".repeat(2000),
    });
    expect(card).toContain("沒有標題的純文字內容");
    expect(tokens(card)).toBeLessThanOrEqual(500);
  });
});

describe("chunkMarkdown", () => {
  const longArticle = Array.from(
    { length: 12 },
    (_, index) =>
      `## 章節 ${index}\n\n${"這是一段中文內文，用來把章節推過切片大小。".repeat(40)}`
  ).join("\n\n");

  it("splits at heading boundaries and carries the heading path", async () => {
    const chunks = await chunkMarkdown({ content: ARTICLE, encoding });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(
      chunks.map((_, index) => index)
    );
    // small sections pack together, so every heading they covered is kept
    expect(
      chunks.some((chunk) =>
        chunk.headingPaths.some((path) => path.includes("HNSW 調校"))
      )
    ).toBe(true);
  });

  it("keeps chunks near the target size", async () => {
    const chunks = await chunkMarkdown({ content: longArticle, encoding });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeGreaterThan(0);
      // packing may overshoot by at most the unit it could not split further
      expect(chunk.tokenCount).toBeLessThan(SECTION_CHUNK_TOKENS * 2);
    }
  });

  it("splits a single oversized section instead of emitting it whole", async () => {
    const oneHugeSection = `## 只有一節\n\n${"很長的一段內文。".repeat(2000)}`;
    const chunks = await chunkMarkdown({ content: oneHugeSection, encoding });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThan(SECTION_CHUNK_TOKENS * 2);
    }
  });

  it("bakes the heading path into every chunk's content", async () => {
    const chunks = await chunkMarkdown({ content: ARTICLE, encoding });
    const hnswChunk = chunks.find((chunk) =>
      chunk.headingPaths.some((path) => path.includes("HNSW 調校"))
    );

    // the section body never mentions its own heading — only the baked-in
    // prefix makes the chunk findable by the heading's words
    expect(hnswChunk?.content).toContain("向量搜尋與嵌入技術 > HNSW 調校");

    const splitChunks = await chunkMarkdown({
      content: `## 只有一節\n\n${"很長的一段內文。".repeat(2000)}`,
      encoding,
    });
    // every piece of an oversized section repeats the prefix — each is its own
    // chunk and must carry the heading context itself
    for (const chunk of splitChunks) {
      expect(chunk.content.startsWith("只有一節\n\n")).toBe(true);
    }
  });

  it("returns nothing for empty content", async () => {
    expect(await chunkMarkdown({ content: "   ", encoding })).toEqual([]);
  });

  it("keeps heading prefixes canonical when display text resembles HTML", async () => {
    const chunks = await chunkMarkdown({
      content:
        "# \\<script>alert(1)\\</script>\n\nThis body contains enough words to exceed the minimum chunk threshold safely.",
      encoding,
    });

    expect(chunks).not.toHaveLength(0);
    expect(chunks[0]?.headingPath).toBe("<script>alert(1)</script>");
    expect(chunks[0]?.content).toContain("\\<script>alert(1)\\</script>");
    expect(chunks[0]?.content.startsWith("<script>")).toBe(false);
  });

  it("does not pack across top-level groups, so an edit cannot cascade", async () => {
    const groups = Array.from(
      { length: 3 },
      (_, index) =>
        `## 主題 ${index}\n\n第一段。\n\n### 主題 ${index} 的細節\n\n第二段。`
    ).join("\n\n");

    const before = await chunkMarkdown({ content: groups, encoding });
    // small sections still pack within their group, never across groups
    for (const chunk of before) {
      const tops = new Set(
        chunk.headingPaths.map((path) => path.split(" > ")[0])
      );
      expect(tops.size).toBe(1);
    }

    // prepending a whole new group must leave every later group's chunk
    // byte-identical — that is what lets replaceResourceChunks treat them as
    // moves and keep their vectors
    const after = await chunkMarkdown({
      content: `## 新主題\n\n新的段落。\n\n${groups}`,
      encoding,
    });
    const beforeContents = new Set(before.map((chunk) => chunk.content));
    const surviving = after.filter((chunk) =>
      beforeContents.has(chunk.content)
    );
    expect(surviving).toHaveLength(before.length);
  });
});
