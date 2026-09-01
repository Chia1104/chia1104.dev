import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import { app } from "../src/server";

import * as dbMocks from "./__mocks__/db.mock";
import * as guardMocks from "./__mocks__/guards.mock";

const rpc = (procedure: string, input: unknown = {}) =>
  app.request(`/api/v1/rpc/feeds/${procedure}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });

/** Assert the repository is called with the clamped scope, not only that the response looks right. */
describe("feeds reads scale with the caller's tier", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
    dbMocks.resetAllDbMocks();
  });

  describe("anonymous", () => {
    beforeEach(() => guardMocks.setCallerTier(CallerTier.Anonymous));

    it("lists only the admin's published feeds", async () => {
      const res = await rpc("list", { limit: 10, type: "all" });

      expect(res.status).toBe(200);
      expect(dbMocks.getInfiniteFeedsByUserId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          whereAnd: { published: true },
          enableDeleted: false,
          userId: guardMocks.TEST_ADMIN_ID,
        })
      );
    });

    it("ignores a request for drafts and deleted feeds", async () => {
      await rpc("list", {
        limit: 10,
        includeUnpublished: true,
        includeDeleted: true,
      });

      expect(dbMocks.getInfiniteFeedsByUserId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          whereAnd: { published: true },
          enableDeleted: false,
        })
      );
    });

    it("clamps an oversized page down to the anonymous cap", async () => {
      await rpc("list", { limit: 1000 });

      expect(dbMocks.getInfiniteFeedsByUserId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ limit: 50 })
      );
    });

    /**
     * Detail and `related` require the project API key (`apps/www` server client);
     * anonymous cannot reach them.
     */
    it.each(["details-by-slug", "details-by-id", "related"])(
      "cannot reach %s at all",
      async (procedure) => {
        const res = await rpc(procedure, { slug: "test-feed-1", feedId: 1 });

        expect(res.status).toBe(401);
      }
    );
  });

  describe("API key", () => {
    beforeEach(() => guardMocks.setCallerTier(CallerTier.ApiKey));

    it("still defaults to published feeds", async () => {
      await rpc("list", { limit: 10 });

      expect(dbMocks.getInfiniteFeedsByUserId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ whereAnd: { published: true } })
      );
    });

    it("drops the published filter when it asks for drafts", async () => {
      await rpc("list", { limit: 10, includeUnpublished: true });

      expect(dbMocks.getInfiniteFeedsByUserId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ whereAnd: {} })
      );
    });

    it("does not gain access to deleted feeds", async () => {
      await rpc("list", { limit: 10, includeDeleted: true });

      expect(dbMocks.getInfiniteFeedsByUserId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ enableDeleted: false })
      );
    });

    it("may ask for the page size the sitemap needs", async () => {
      await rpc("list", { limit: 1000 });

      expect(dbMocks.getInfiniteFeedsByUserId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ limit: 1000 })
      );
    });

    it("scopes details-by-slug to the admin's published feeds", async () => {
      await rpc("details-by-slug", { slug: "test-feed-1" });

      expect(dbMocks.getFeedBySlug).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          slug: "test-feed-1",
          published: true,
          userId: guardMocks.TEST_ADMIN_ID,
        })
      );
    });

    // `details-by-id` backs the dash edit view only, so a key is not enough.
    it("cannot reach details-by-id", async () => {
      const res = await rpc("details-by-id", { feedId: 1 });

      expect(res.status).toBe(403);
    });
  });

  describe("root session", () => {
    beforeEach(() => guardMocks.setCallerTier(CallerTier.Root));

    it("sees its own drafts and deleted feeds when it asks", async () => {
      await rpc("list", {
        limit: 10,
        includeUnpublished: true,
        includeDeleted: true,
      });

      expect(dbMocks.getInfiniteFeedsByUserId).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          whereAnd: {},
          enableDeleted: true,
          userId: guardMocks.TEST_ADMIN_ID,
        })
      );
    });
  });

  it("serves the dash edit view its draft, deleted feed", async () => {
    guardMocks.setCallerTier(CallerTier.Session);

    await rpc("details-by-id", {
      feedId: 1,
      includeUnpublished: true,
      includeDeleted: true,
    });

    expect(dbMocks.getFeedById).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        feedId: 1,
        published: undefined,
        enableDeleted: true,
      })
    );
  });

  it("serves related feeds to a keyed caller", async () => {
    guardMocks.setCallerTier(CallerTier.ApiKey);
    dbMocks.getRelatedFeeds.mockResolvedValue([]);

    const related = await rpc("related", { slug: "test-feed", limit: 3 });

    expect(related.status).toBe(200);
  });
});
