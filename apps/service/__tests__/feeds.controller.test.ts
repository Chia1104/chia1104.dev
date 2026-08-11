import { app } from "../src/server";

import * as dbMocks from "./__mocks__/db.mock";
import * as guardMocks from "./__mocks__/guards.mock";

const { mockSearchPublicFeedsService } = vi.hoisted(() => ({
  mockSearchPublicFeedsService: vi.fn(),
}));

// The search services moved to `@chia/api/feeds/search`, next to the oRPC procedures
// that now serve `/feeds/public/search` and `/feeds/search`. URLs and assertions below
// are unchanged — only the mock target follows the code.
vi.mock("@chia/api/feeds/search", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@chia/api/feeds/search")>();
  return {
    ...actual,
    searchPublicFeedsService: mockSearchPublicFeedsService,
  };
});

describe("Feeds Controller", () => {
  beforeEach(() => {
    dbMocks.resetAllDbMocks();
    guardMocks.resetAllGuardMocks();
    mockSearchPublicFeedsService.mockReset();
    mockSearchPublicFeedsService.mockResolvedValue([]);
  });
  describe("GET /api/v1/feeds/public/search", () => {
    it("should return public search results", async () => {
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

      const res = await app.request(
        "/api/v1/feeds/public/search?keyword=test&locale=zh-TW"
      );

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        items: [
          expect.objectContaining({
            feedId: 1,
            slug: "test-feed",
          }),
        ],
      });
      expect(mockSearchPublicFeedsService).toHaveBeenCalledWith(
        expect.objectContaining({
          keyword: "test",
          locale: "zh-TW",
          limit: 5,
        })
      );
    });

    it("should reject a query shorter than two characters", async () => {
      const res = await app.request(
        "/api/v1/feeds/public/search?keyword=x&locale=zh-TW"
      );

      expect(res.status).toBe(400);
      expect(mockSearchPublicFeedsService).not.toHaveBeenCalled();
    });
  });
});
