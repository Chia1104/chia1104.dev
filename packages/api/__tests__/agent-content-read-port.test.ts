import type { DB } from "@chia/db/client";

import { createContentReadPort } from "../agents/content-read.port";

import * as dbMocks from "./__mocks__/agent-content-db.mock";

const searchFeedsService = vi.hoisted(() =>
  vi.fn(async () => ({ mode: "hybrid", items: [] }))
);
vi.mock("../feeds/search", () => ({ searchFeedsService }));
vi.mock("@chia/db/repos/feeds", async () => {
  const mocks = await import("./__mocks__/agent-content-db.mock");
  return {
    getFeedById: mocks.getFeedById,
    getFeedBySlug: mocks.getFeedBySlug,
    getInfiniteFeeds: mocks.getInfiniteFeeds,
  };
});

/**
 * Visibility is fixed when the port is built and cannot be widened by a tool call. These pin
 * the property a public agent's safety rests on: a `public` port never asks the repository for
 * an unpublished post, and never lists drafts even when asked to.
 */

const AUTHOR = "author-1";
// SAFETY: every repository call is mocked, so the port never dereferences the connection.
const db = {} as DB;

describe("createContentReadPort visibility", () => {
  beforeEach(() => {
    dbMocks.resetAgentContentDbMocks();
    searchFeedsService.mockClear();
  });

  describe("public", () => {
    const port = createContentReadPort({
      db,
      authorId: AUTHOR,
      visibility: "public",
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

    it("lists published posts when asked for everything", async () => {
      await port.listPosts({ limit: 10 });

      expect(dbMocks.getInfiniteFeeds).toHaveBeenCalledWith(
        db,
        expect.objectContaining({
          whereAnd: { userId: AUTHOR, published: true },
        })
      );
    });

    it("searches published chunks only", async () => {
      await port.searchPosts({ keyword: "x", mode: "keyword", limit: 5 });

      expect(searchFeedsService).toHaveBeenCalledWith(
        expect.objectContaining({ includeUnpublished: false })
      );
    });

    it("answers a request for drafts with nothing, without querying", async () => {
      await expect(
        port.listPosts({ limit: 10, published: false })
      ).resolves.toEqual([]);

      expect(dbMocks.getInfiniteFeeds).not.toHaveBeenCalled();
    });
  });

  describe("author", () => {
    const port = createContentReadPort({
      db,
      authorId: AUTHOR,
      visibility: "author",
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

    it("lists everything when no filter is given", async () => {
      await port.listPosts({ limit: 10 });

      expect(dbMocks.getInfiniteFeeds).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ whereAnd: { userId: AUTHOR } })
      );
    });
  });
});
