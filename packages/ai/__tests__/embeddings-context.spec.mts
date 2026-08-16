import { getEncoding } from "js-tiktoken";
import { describe, expect, it } from "vitest";

import {
  buildDocumentContext,
  buildHeadingAnchors,
} from "../src/embeddings/context";

const encoding = getEncoding("cl100k_base");
const tokens = (text: string) => encoding.encode(text).length;

const SHORT = `# 標題

## 什麼是 embedding

短短的內文。

## HNSW 調校

也很短。
`;

const long = (sections: number, repeat: number) =>
  Array.from(
    { length: sections },
    (_, index) =>
      `## 章節 ${index}\n\n${"這是一段中文內文，用來把文章長度推高。".repeat(repeat)}`
  ).join("\n\n");

describe("buildHeadingAnchors", () => {
  it("produces github-style anchors per heading", async () => {
    const anchors = await buildHeadingAnchors(
      "# Hello World\n\n## ef_search 調校"
    );
    expect(anchors.map((anchor) => anchor.anchor)).toEqual([
      "#hello-world",
      "#ef_search-調校",
    ]);
    expect(anchors[1]?.path).toBe("Hello World > ef_search 調校");
  });

  it("restarts numbering per document so repeated headings do not drift", async () => {
    const content = "## Setup\n\ntext\n\n## Setup\n\ntext";
    expect((await buildHeadingAnchors(content)).map((a) => a.anchor)).toEqual([
      "#setup",
      "#setup-1",
    ]);
    // a second call must behave identically, not continue from -1
    expect((await buildHeadingAnchors(content)).map((a) => a.anchor)).toEqual([
      "#setup",
      "#setup-1",
    ]);
  });
});

describe("buildDocumentContext", () => {
  it("returns short documents in full with anchors", async () => {
    const result = await buildDocumentContext([
      { slug: "a", locale: "zh-TW", title: "t", content: SHORT },
    ]);
    expect(result.documents[0]?.detail).toBe("full");
    expect(result.documents[0]?.text).toBe(SHORT);
    expect(result.documents[0]?.anchors.length).toBe(3);
    expect(result.droppedSlugs).toEqual([]);
  });

  it("never exceeds the shared budget across several documents", async () => {
    const budget = 2000;
    const result = await buildDocumentContext(
      [
        { slug: "a", locale: "zh-TW", title: "a", content: long(10, 40) },
        { slug: "b", locale: "en", title: "b", content: long(10, 40) },
        { slug: "c", locale: "zh-TW", title: "c", content: long(10, 40) },
      ],
      { budget }
    );
    expect(result.totalTokens).toBeLessThanOrEqual(budget);
    const summed = result.documents.reduce(
      (sum, document) => sum + tokens(document.text),
      0
    );
    expect(summed).toBeLessThanOrEqual(budget);
  });

  it("degrades full → sections → outline rather than cutting mid-sentence", async () => {
    const content = long(12, 60);
    const full = await buildDocumentContext(
      [{ slug: "a", locale: "zh-TW", title: "a", content }],
      { budget: 100_000 }
    );
    expect(full.documents[0]?.detail).toBe("full");

    const degraded = await buildDocumentContext(
      [{ slug: "a", locale: "zh-TW", title: "a", content }],
      { budget: 3000 }
    );
    expect(degraded.documents[0]?.detail).toBe("sections");

    const outlineOnly = await buildDocumentContext(
      [
        {
          slug: "a",
          locale: "zh-TW",
          title: "a",
          summary: "摘要一句。",
          content,
        },
      ],
      { budget: 120 }
    );
    expect(outlineOnly.documents[0]?.detail).toBe("outline");
    expect(outlineOnly.documents[0]?.text).toContain("摘要一句。");
  });

  it("keeps the retriever's matched sections when degrading", async () => {
    const content = [
      "## 不相關的章節",
      "無關內文。".repeat(400),
      "## ef_search 調校",
      "這段才是命中的內容。".repeat(20),
    ].join("\n\n");

    const result = await buildDocumentContext(
      [
        {
          slug: "a",
          locale: "zh-TW",
          title: "a",
          content,
          matchedHeadingPaths: ["ef_search 調校"],
        },
      ],
      { budget: 600 }
    );

    expect(result.documents[0]?.detail).toBe("sections");
    expect(result.documents[0]?.text).toContain("這段才是命中的內容");
  });

  it("does not let one document starve the rest", async () => {
    const result = await buildDocumentContext(
      [
        { slug: "big", locale: "zh-TW", title: "big", content: long(20, 80) },
        { slug: "small", locale: "en", title: "small", content: SHORT },
      ],
      { budget: 4000 }
    );
    // the second document still made it in
    expect(result.documents.map((document) => document.slug)).toContain(
      "small"
    );
    expect(result.droppedSlugs).toEqual([]);
  });

  it("reports documents dropped once the budget is exhausted", async () => {
    const result = await buildDocumentContext(
      [
        { slug: "a", locale: "zh-TW", title: "a", content: long(6, 40) },
        { slug: "b", locale: "en", title: "b", content: long(6, 40) },
        { slug: "c", locale: "zh-TW", title: "c", content: long(6, 40) },
      ],
      { budget: 900 }
    );
    expect(result.totalTokens).toBeLessThanOrEqual(900);
  });
});
