import { searchPublicFeedsService } from "@chia/api/feeds/search";
import type { DB } from "@chia/db";

import * as dbMocks from "./__mocks__/db.mock";

const hit = (sourceId: number) => ({
  sourceType: "feed_translation",
  sourceId,
  score: 1,
  matchedChunks: 1,
  bestChunk: {
    chunkId: sourceId,
    sourceType: "feed_translation",
    sourceId,
    kind: "section" as const,
    chunkIndex: 0,
    headingPath: null,
    snippet: "<b>public</b> body",
    score: 1,
    lexicalRank: 1,
    semanticRank: null,
  },
  summary: {
    sourceType: "feed_translation",
    sourceId,
    title: "t",
    description: null,
    href: null,
    locale: "zh-TW",
  },
});

describe("Public feeds search service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getPublicFeedSummariesByIds.mockResolvedValue([
      {
        id: 1,
        type: "post",
        slug: "public-post",
        locale: "zh-TW",
        title: "Public post",
        description: "Description",
        excerpt: "Excerpt",
      },
    ]);
  });

  it("hydrates chunk hits with authoritative public database data", async () => {
    dbMocks.searchResources.mockResolvedValue({
      mode: "bm25",
      // the second hit's feed is not publicly visible and must be dropped
      items: [hit(11), hit(99)],
    });
    dbMocks.getFeedRefsByTranslationIds.mockResolvedValue([
      { translationId: 11, feedId: 1, slug: "public-post" },
      { translationId: 99, feedId: 999, slug: "hidden" },
    ]);

    const result = await searchPublicFeedsService({
      db: {} as DB,
      keyword: "public",
      locale: "zh-TW",
    });

    expect(result).toEqual([
      {
        feedId: 1,
        type: "post",
        slug: "public-post",
        locale: "zh-TW",
        title: "Public post",
        description: "Description",
        excerpt: "Excerpt",
      },
    ]);
    // the indexed body must never reach the public response
    for (const item of result) {
      expect(item).not.toHaveProperty("content");
      expect(item).not.toHaveProperty("snippet");
    }
    expect(dbMocks.searchResources).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "bm25", locale: "zh-TW" })
    );
  });

  it("skips the summary lookup when nothing matched", async () => {
    dbMocks.searchResources.mockResolvedValue({ mode: "bm25", items: [] });

    const result = await searchPublicFeedsService({
      db: {} as DB,
      keyword: "nothing",
      locale: "zh-TW",
    });

    expect(result).toEqual([]);
    expect(dbMocks.getPublicFeedSummariesByIds).not.toHaveBeenCalled();
  });
});
