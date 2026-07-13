const { mockSearchSingleIndex } = vi.hoisted(() => ({
  mockSearchSingleIndex: vi.fn(),
}));

vi.mock("@chia/api/algolia", () => ({
  client: {
    searchSingleIndex: mockSearchSingleIndex,
  },
}));

import type { DB } from "@chia/db";

import { searchPublicFeedsService } from "../src/services/feeds.service";

import * as dbMocks from "./__mocks__/db.mock";

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

  it("should hydrate Algolia hits with authoritative public database data", async () => {
    mockSearchSingleIndex.mockResolvedValue({
      hits: [
        {
          feedID: 1,
          content: "private indexed body",
        },
        {
          feedID: 999,
          content: "stale unpublished body",
        },
      ],
    });

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
    expect(result[0]).not.toHaveProperty("content");
    expect(dbMocks.getPublicFeedSummariesByIds).toHaveBeenCalledWith(
      expect.anything(),
      {
        feedIds: [1, 999],
        locale: "zh-TW",
      }
    );
  });
});
