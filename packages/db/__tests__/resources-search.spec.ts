import { describe, expect, it } from "vitest";

import { aggregateChunkHits } from "../src/libs/resources/search.ts";
import type { ChunkHit } from "../src/libs/resources/search.ts";

const hit = (
  sourceId: number,
  score: number,
  overrides: Partial<ChunkHit> = {}
): ChunkHit => ({
  chunkId: sourceId * 100 + Math.round(score * 1000),
  sourceType: "feed_translation",
  sourceId,
  kind: "section",
  chunkIndex: 0,
  headingPath: null,
  headingPaths: [],
  content: "",
  snippet: null,
  score,
  lexicalRank: null,
  semanticRank: null,
  ...overrides,
});

describe("aggregateChunkHits", () => {
  it("rewards breadth: several relevant chunks outrank one equal best chunk", () => {
    // both resources share the same best chunk score; resource 2 has two more
    // relevant chunks. Under a top-N mean it would have lost or tied
    const hits = [hit(1, 0.9), hit(2, 0.9), hit(2, 0.5), hit(2, 0.4)].sort(
      (a, b) => b.score - a.score
    );

    const [first, second] = aggregateChunkHits(hits, 10);
    expect(first?.sourceId).toBe(2);
    expect(second?.sourceId).toBe(1);
  });

  it("caps the score at top-N chunks so length alone cannot win", () => {
    const many = Array.from({ length: 10 }, () => hit(1, 0.2));
    const focused = [hit(2, 0.9), hit(2, 0.9)];
    const hits = [...focused, ...many];

    const [first] = aggregateChunkHits(hits, 10);
    // 0.2 × (1 + ¹⁄₁₀ + ¹⁄₁₀₀) < 0.9 × (1 + ¹⁄₁₀). Chunks beyond the top N
    // contribute nothing, and decayed later ranks cannot pile up past a
    // dominant best chunk
    expect(first?.sourceId).toBe(2);
  });

  it("keeps the chunks that each reach a new section, best first", () => {
    const hits = [
      hit(1, 0.9, { headingPath: "A > B", headingPaths: ["A > B", "A > C"] }),
      // a second fragment of a covered section, and a later card, add nowhere to read
      hit(1, 0.8, { headingPath: "A > C", headingPaths: ["A > C"] }),
      hit(1, 0.7, { kind: "card" }),
      hit(1, 0.5, { headingPath: "D", headingPaths: ["D"] }),
    ];

    const [first] = aggregateChunkHits(hits, 10);
    expect(first?.chunks.map((chunk) => chunk.headingPath)).toEqual([
      "A > B",
      "D",
    ]);
    expect(first?.matchedChunks).toBe(4);
  });

  it("slices to the limit after sorting", () => {
    const hits = [hit(1, 0.9), hit(2, 0.8), hit(3, 0.7)];
    const results = aggregateChunkHits(hits, 2);
    expect(results.map((result) => result.sourceId)).toEqual([1, 2]);
  });
});
