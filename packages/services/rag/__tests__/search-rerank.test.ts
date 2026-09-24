import { describe, expect, it, vi } from "vitest";

import type { RerankProvider } from "@chia/ai/rerank/provider";
import { ResourceChunkKind } from "@chia/db/schema";
import { Locale } from "@chia/db/types";

const logger = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("@chia/observability/logger", () => ({ logger }));

import { ResourceType } from "../resource-types";
import { rerankHits } from "../search.service";
import type { ResourceSearchHit } from "../search.service";

const hit = (sourceId: number): ResourceSearchHit => ({
  sourceType: ResourceType.FeedTranslation,
  sourceId,
  score: 1 / sourceId,
  matchedChunks: 1,
  chunks: [
    {
      chunkId: sourceId,
      sourceType: ResourceType.FeedTranslation,
      sourceId,
      kind: ResourceChunkKind.Section,
      chunkIndex: 0,
      headingPath: `H${sourceId}`,
      headingPaths: [`H${sourceId}`],
      content: `body ${sourceId}`,
      snippet: null,
      score: 1,
      lexicalRank: null,
      semanticRank: null,
    },
  ],
  summary: {
    sourceType: ResourceType.FeedTranslation,
    sourceId,
    title: `T${sourceId}`,
    description: null,
    href: null,
    locale: Locale.ZhTW,
  },
});

const provider = (rerank: RerankProvider["rerank"]): RerankProvider => ({
  id: "fake",
  rerank,
});

describe("rerankHits", () => {
  it("applies the provider's order, trims to the limit and reports answerability", async () => {
    const rerank = vi.fn<RerankProvider["rerank"]>().mockResolvedValue({
      order: ["feed_translation:3", "feed_translation:1", "feed_translation:2"],
      answerable: 0.9,
    });

    const result = await rerankHits(
      "q",
      [hit(1), hit(2), hit(3)],
      2,
      provider(rerank)
    );

    expect(result.items.map((item) => item.sourceId)).toEqual([3, 1]);
    expect(result.answerable).toBe(0.9);
    // the provider sees the excerpts an agent sees, keyed so the order maps back
    expect(rerank.mock.calls[0]?.[1]).toEqual([
      {
        key: "feed_translation:1",
        title: "T1",
        matches: [{ headingPaths: ["H1"], snippet: "body 1" }],
      },
      {
        key: "feed_translation:2",
        title: "T2",
        matches: [{ headingPaths: ["H2"], snippet: "body 2" }],
      },
      {
        key: "feed_translation:3",
        title: "T3",
        matches: [{ headingPaths: ["H3"], snippet: "body 3" }],
      },
    ]);
  });

  it("keeps a hit the provider left out, behind the ranked ones", async () => {
    const result = await rerankHits(
      "q",
      [hit(1), hit(2), hit(3)],
      3,
      provider(async () => ({ order: ["feed_translation:2"], answerable: 0.4 }))
    );

    expect(result.items.map((item) => item.sourceId)).toEqual([2, 1, 3]);
  });

  it("keeps the fused order and no answerability when the provider fails", async () => {
    const result = await rerankHits(
      "q",
      [hit(1), hit(2), hit(3)],
      2,
      provider(async () => {
        throw new Error("timed out");
      })
    );

    expect(result.items.map((item) => item.sourceId)).toEqual([1, 2]);
    expect(result.answerable).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "fake" }),
      "Rerank failed; keeping the fused order"
    );
  });
});
