import type { DB } from "@chia/db";

import { createContentReadPort } from "../src/services/content-read.port";

import * as dbMocks from "./__mocks__/db.mock";

/**
 * Visibility is fixed when the port is built and cannot be widened by a tool call. These pin
 * the property a public agent's safety rests on: a `public` port never asks the repository for
 * an unpublished post, and never lists drafts even when asked to.
 */

const AUTHOR = "author-1";
const db = {} as DB;

describe("createContentReadPort visibility", () => {
  beforeEach(() => {
    dbMocks.resetAllDbMocks();
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
