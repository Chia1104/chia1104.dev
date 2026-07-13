import { beforeEach } from "vitest";

const { mockSearchPublicFeedsService } = vi.hoisted(() => ({
  mockSearchPublicFeedsService: vi.fn(),
}));

vi.mock("../src/services/feeds.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/services/feeds.service")>();
  return {
    ...actual,
    searchPublicFeedsService: mockSearchPublicFeedsService,
  };
});

import { app } from "../src/server";

import * as dbMocks from "./__mocks__/db.mock";
import * as guardMocks from "./__mocks__/guards.mock";

describe("Feeds Controller", () => {
  beforeEach(() => {
    dbMocks.resetAllDbMocks();
    guardMocks.resetAllGuardMocks();
    mockSearchPublicFeedsService.mockReset();
    mockSearchPublicFeedsService.mockResolvedValue([]);
  });
  describe("GET /api/v1/feeds/public", () => {
    it("should return public feeds", async () => {
      const res = await app.request("/api/v1/feeds/public");

      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("items");
      expect(data).toHaveProperty("meta");
    }, 15000);

    it("should handle limit parameter", async () => {
      const res = await app.request("/api/v1/feeds/public?limit=5");

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.items).toBeDefined();
      expect(Array.isArray(data.items)).toBe(true);
    }, 15000);

    it("should reject invalid limit parameter", async () => {
      const res = await app.request(
        "/api/v1/feeds/public?limit=foo&orderBy=updatedAt"
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty("code");
    }, 15000);

    it("should handle orderBy parameter", async () => {
      const res = await app.request(
        "/api/v1/feeds/public?orderBy=createdAt&sortOrder=desc"
      );

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty("items");
    }, 15000);

    it("should handle locale parameter", async () => {
      const res = await app.request("/api/v1/feeds/public?locale=en");

      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data).toHaveProperty("items");
    }, 15000);
  });

  describe("GET /api/v1/feeds/public/search", () => {
    it("should return public Algolia search results", async () => {
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
