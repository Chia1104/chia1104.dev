import { describe, it, expect, vi, beforeEach } from "vitest";

import { Locale, FeedType } from "@chia/db/types";

import { client } from "@/libs/service/client.rsc";
import { HonoRPCError } from "@/libs/service/error";
import {
  getPosts,
  getNotes,
  getFeedsWithType,
  getFeeds,
  getFeedBySlug,
} from "@/services/feeds.service";

// Mock the client
vi.mock("@/libs/service/client.rsc", () => ({
  client: {
    api: {
      v1: {
        admin: {
          public: {
            feeds: {
              $get: vi.fn(),
              ":slug": {
                $get: vi.fn(),
              },
            },
          },
        },
      },
    },
  },
}));

// 取得 mock 函數的引用
const mockGet = client.api.v1.admin.public.feeds.$get as ReturnType<
  typeof vi.fn
>;
const mockGetBySlug = client.api.v1.admin.public.feeds[":slug"]
  .$get as ReturnType<typeof vi.fn>;

describe("Feeds Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPosts", () => {
    it("應該成功獲取 posts", async () => {
      const mockData = {
        data: [
          { id: "1", title: "Post 1", type: FeedType.Post },
          { id: "2", title: "Post 2", type: FeedType.Post },
        ],
      };

      mockGet.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData,
      });

      const result = await getPosts(10);

      expect(result).toEqual(mockData);
      expect(mockGet).toHaveBeenCalledWith({
        query: {
          limit: "10",
          type: "post",
          published: "true",
          orderBy: "createdAt",
          sortOrder: "desc",
          withContent: "false",
          locale: Locale.zhTW,
        },
      });
    });

    it("應該使用默認 limit 值", async () => {
      mockGet.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await getPosts();

      expect(mockGet).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            limit: "10",
          }),
        })
      );
    });

    it("應該在請求失敗時拋出 HonoRPCError", async () => {
      mockGet.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(getPosts()).rejects.toThrow(HonoRPCError);
    });

    it("應該處理未知錯誤", async () => {
      mockGet.mockRejectedValue(new Error("Network error"));

      await expect(getPosts()).rejects.toThrow(HonoRPCError);
    });
  });

  describe("getNotes", () => {
    it("應該成功獲取 notes", async () => {
      const mockData = {
        data: [
          { id: "1", title: "Note 1", type: FeedType.Note },
          { id: "2", title: "Note 2", type: FeedType.Note },
        ],
      };

      mockGet.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const result = await getNotes(5);

      expect(result).toEqual(mockData);
      expect(mockGet).toHaveBeenCalledWith({
        query: {
          limit: "5",
          type: "note",
          published: "true",
          orderBy: "createdAt",
          sortOrder: "desc",
          withContent: "false",
          locale: Locale.zhTW,
        },
      });
    });
  });

  describe("getFeedsWithType", () => {
    it("應該根據類型獲取 feeds", async () => {
      const mockData = { data: [] };

      mockGet.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      await getFeedsWithType("post", 10);

      expect(mockGet).toHaveBeenCalledWith({
        query: {
          limit: "10",
          type: "post",
          published: "true",
          orderBy: "createdAt",
          sortOrder: "desc",
          withContent: "false",
          locale: Locale.zhTW,
        },
      });
    });

    it("應該支援不同的 feed 類型", async () => {
      mockGet.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await getFeedsWithType("note");

      expect(mockGet).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            type: "note",
          }),
        })
      );
    });
  });

  describe("getFeeds", () => {
    it("應該獲取所有類型的 feeds", async () => {
      const mockData = { data: [] };

      mockGet.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      await getFeeds(20);

      expect(mockGet).toHaveBeenCalledWith({
        query: {
          limit: "20",
          type: "all",
          published: "true",
          orderBy: "createdAt",
          sortOrder: "desc",
          withContent: "false",
          locale: Locale.zhTW,
        },
      });
    });
  });

  describe("getFeedBySlug", () => {
    it("應該根據 slug 獲取單一 feed", async () => {
      const mockData = {
        data: { id: "1", slug: "test-slug", title: "Test Post" },
      };

      mockGetBySlug.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const result = await getFeedBySlug("test-slug");

      expect(result).toEqual(mockData);
      expect(mockGetBySlug).toHaveBeenCalledWith({
        param: { slug: "test-slug" },
        query: { locale: Locale.zhTW },
      });
    });

    it("應該支援自定義 locale", async () => {
      mockGetBySlug.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      await getFeedBySlug("test-slug", Locale.En);

      expect(mockGetBySlug).toHaveBeenCalledWith({
        param: { slug: "test-slug" },
        query: { locale: Locale.En },
      });
    });

    it("應該在 404 時返回 null", async () => {
      mockGetBySlug.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await getFeedBySlug("non-existent-slug");

      expect(result).toBeNull();
    });

    it("應該在其他錯誤時拋出異常", async () => {
      mockGetBySlug.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Server Error",
      });

      await expect(getFeedBySlug("test-slug")).rejects.toThrow(HonoRPCError);
    });
  });
});
