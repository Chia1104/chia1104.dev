import { safe } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as dbMocks from "@chia/test/mocks/db-feeds";

import * as guardMocks from "./helpers/guards";
import { client, errorCode } from "./helpers/rpc";

const { mockSearchPublicFeedsService } = vi.hoisted(() => ({
  mockSearchPublicFeedsService: vi.fn(),
}));

vi.mock("@chia/api/feeds/search", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@chia/api/feeds/search")>();
  return {
    ...actual,
    searchPublicFeedsService: mockSearchPublicFeedsService,
  };
});

describe("feeds.search", () => {
  beforeEach(() => {
    dbMocks.resetAllDbMocks();
    guardMocks.resetAllGuardMocks();
    mockSearchPublicFeedsService.mockReset();
    mockSearchPublicFeedsService.mockResolvedValue([]);
  });

  it("returns public search results", async () => {
    mockSearchPublicFeedsService.mockResolvedValue([
      {
        feedId: 1,
        type: "post",
        slug: "test-feed",
        locale: "zh-TW",
        title: "Test feed",
        description: "Description",
        excerpt: "",
      },
    ]);

    const data = await client.feeds.search({
      keyword: "test",
      locale: "zh-TW",
    });

    expect(data.items).toEqual([
      expect.objectContaining({
        feedId: 1,
        slug: "test-feed",
      }),
    ]);
    expect(mockSearchPublicFeedsService).toHaveBeenCalledWith(
      expect.objectContaining({
        keyword: "test",
        locale: "zh-TW",
        limit: 5,
      })
    );
  });

  it("rejects a query shorter than two characters", async () => {
    const { error } = await safe(
      client.feeds.search({ keyword: "x", locale: "zh-TW" })
    );

    expect(errorCode(error)).toBe("BAD_REQUEST");
    expect(mockSearchPublicFeedsService).not.toHaveBeenCalled();
  });
});
