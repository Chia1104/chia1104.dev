import { drizzle } from "drizzle-orm/node-postgres";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { relations } from "@chia/db/schema";
import { FeedOrderBy, FeedType, Locale } from "@chia/db/types";
import * as dbMocks from "@chia/test/mocks/db-feeds";

import { ContentVisibility, createContentReadPort } from "../content-read.port";

const searchFeedsService = vi.hoisted(() =>
  vi.fn(async () => ({ mode: "hybrid", items: [] }))
);
vi.mock("../../feeds/search.service", () => ({ searchFeedsService }));
vi.mock("@chia/db/repos/feeds", async () => {
  const mocks = await import("@chia/test/mocks/db-feeds");
  return {
    getFeedById: mocks.getFeedById,
    getFeedBySlug: mocks.getFeedBySlug,
    getInfiniteFeeds: mocks.getInfiniteFeeds,
    countFeeds: mocks.countFeeds,
  };
});

/**
 * Visibility is fixed when the port is built and cannot be widened by a tool call. A
 * `public` port never asks the repository for an unpublished post, and never lists drafts
 * even when asked to.
 */

const AUTHOR = "author-1";
/** Every repository call is mocked, so the port never reaches the connection. */
const db = drizzle.mock({ relations });

describe("createContentReadPort visibility", () => {
  beforeEach(() => {
    dbMocks.resetAllDbMocks();
    searchFeedsService.mockClear();
  });

  describe("public", () => {
    const port = createContentReadPort({
      db,
      authorId: AUTHOR,
      visibility: ContentVisibility.Public,
    });

    it("reads a post only within the published scope, by id and by slug", async () => {
      await port.getPost({ feedId: 1 });
      await port.getPost({ slug: "test-feed-1" });

      expect(dbMocks.getFeedById).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ userId: AUTHOR, published: true })
      );
      expect(dbMocks.getFeedBySlug).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ userId: AUTHOR, published: true })
      );
    });

    it("carries the page of each post as the site serves it", async () => {
      const post = await port.getPost({ slug: "test-feed-1" });
      expect(post).toMatchObject({
        url: "http://localhost:3000/en-US/posts/test-feed-1",
        translations: [
          {
            locale: Locale.En,
            url: "http://localhost:3000/en-US/posts/test-feed-1",
          },
        ],
      });

      const { posts } = await port.listPosts({ limit: 10 });
      expect(posts[0]?.url).toBe(
        "http://localhost:3000/en-US/posts/test-feed-1"
      );
    });

    it("lists published posts when asked for everything", async () => {
      await port.listPosts({ limit: 10 });

      expect(dbMocks.getInfiniteFeeds).toHaveBeenCalledWith(
        db,
        expect.objectContaining({
          whereAnd: { userId: AUTHOR, published: true },
        })
      );
    });

    it("searches published chunks only, asking for the reranked order", async () => {
      const result = await port.searchPosts({
        keyword: "x",
        mode: "keyword",
        limit: 5,
      });

      expect(searchFeedsService).toHaveBeenCalledWith(
        expect.objectContaining({ includeUnpublished: false, rerank: true })
      );
      expect(result).toEqual({ hits: [], answerable: null });
    });

    it("answers a request for drafts with nothing, without querying", async () => {
      await expect(
        port.listPosts({ limit: 10, published: false })
      ).resolves.toEqual({ posts: [], total: 0 });

      expect(dbMocks.getInfiniteFeeds).not.toHaveBeenCalled();
      expect(dbMocks.countFeeds).not.toHaveBeenCalled();
    });
  });

  describe("author", () => {
    const port = createContentReadPort({
      db,
      authorId: AUTHOR,
      visibility: ContentVisibility.Author,
    });

    it("reads a post regardless of published state", async () => {
      await port.getPost({ feedId: 1 });

      expect(dbMocks.getFeedById).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ userId: AUTHOR, published: undefined })
      );
    });

    it("searches draft chunks as well", async () => {
      await port.searchPosts({ keyword: "x", mode: "semantic", limit: 5 });

      expect(searchFeedsService).toHaveBeenCalledWith(
        expect.objectContaining({ includeUnpublished: true })
      );
    });

    it("lists drafts when asked", async () => {
      await port.listPosts({ limit: 10, published: false });

      expect(dbMocks.getInfiniteFeeds).toHaveBeenCalledWith(
        db,
        expect.objectContaining({
          whereAnd: { userId: AUTHOR, published: false },
        })
      );
    });

    it("lists and counts under the same filters, notes included", async () => {
      dbMocks.countFeeds.mockResolvedValueOnce(42);

      const { total } = await port.listPosts({
        limit: 10,
        type: FeedType.Note,
        tagSlug: "react",
        createdFrom: "2025-01-01",
        createdBefore: "2026-01-01",
      });

      expect(total).toBe(42);
      expect(dbMocks.getInfiniteFeeds).toHaveBeenCalledWith(
        db,
        expect.objectContaining({
          type: FeedType.Note,
          tagSlug: "react",
          orderBy: FeedOrderBy.CreatedAt,
          whereAnd: expect.objectContaining({
            createdAt: {
              gte: new Date("2025-01-01"),
              lt: new Date("2026-01-01"),
            },
          }),
        })
      );
      expect(dbMocks.countFeeds).toHaveBeenCalledWith(db, {
        userId: AUTHOR,
        published: undefined,
        type: FeedType.Note,
        tagSlug: "react",
        createdFrom: new Date("2025-01-01"),
        createdBefore: new Date("2026-01-01"),
      });

      await port.listPosts({ limit: 10 });
      expect(dbMocks.getInfiniteFeeds).toHaveBeenLastCalledWith(
        db,
        expect.objectContaining({ type: FeedType.All })
      );
    });

    it("lists everything when no filter is given", async () => {
      await port.listPosts({ limit: 10 });

      expect(dbMocks.getInfiniteFeeds).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ whereAnd: { userId: AUTHOR } })
      );
    });
  });
});
