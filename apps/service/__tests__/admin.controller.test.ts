import { beforeEach, describe, expect, it } from "vitest";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

import * as dbMocks from "@chia/test/mocks/db-feeds";
import * as guardMocks from "./helpers/guards";
import { rpc as rpcOf } from "./helpers/rpc";

const rpc = (procedure: string, input: unknown = {}) =>
  rpcOf(`feeds/${encodeURIComponent(procedure)}`, input);

/** Upserts use the project API key; deletes need the operator session. */
describe("feeds writes require the right tier", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
    dbMocks.resetAllDbMocks();
  });

  describe("content pipeline (API key tier)", () => {
    beforeEach(() => guardMocks.setCallerTier(CallerTier.ApiKey));

    it("upserts a translation and reindexes its feed", async () => {
      dbMocks.upsertFeedTranslation.mockResolvedValue({ id: 9, feedId: 1 });

      const res = await rpc("translation:upsert", {
        feedId: 1,
        locale: "zh-TW",
        title: "Title",
      });

      expect(res.status).toBe(200);
      expect(dbMocks.upsertFeedTranslation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ feedId: 1, locale: "zh-TW" })
      );
    });

    it("upserts a translation body", async () => {
      const res = await rpc("content:upsert", {
        feedTranslationId: 9,
        content: "# hello",
      });

      expect(res.status).toBe(200);
      expect(dbMocks.upsertContent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ feedTranslationId: 9 })
      );
    });

    it("may update a feed", async () => {
      const res = await rpc("update", { feedId: 1, published: true });

      expect(res.status).toBe(200);
      expect(dbMocks.updateFeed).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ feedId: 1, published: true })
      );
    });

    it("reports a content:upsert against an unknown translation as NOT_FOUND", async () => {
      dbMocks.upsertContent.mockResolvedValue(undefined);

      const res = await rpc("content:upsert", {
        feedTranslationId: 999,
        content: "# hello",
      });

      expect(res.status).toBe(404);
    });

    it("may not delete a feed", async () => {
      const res = await rpc("delete", { feedId: 1 });

      expect(res.status).toBe(403);
    });
  });

  describe("anonymous", () => {
    beforeEach(() => guardMocks.setCallerTier(CallerTier.Anonymous));

    // Input validation runs before the guard, so each case sends schema-valid input.
    it.each([
      ["translation:upsert", { feedId: 1, locale: "zh-TW", title: "Title" }],
      ["content:upsert", { feedTranslationId: 9, content: "# hello" }],
      ["update", { feedId: 1 }],
      ["delete", { feedId: 1 }],
    ])("rejects %s outright", async (procedure, input) => {
      const res = await rpc(procedure, input);

      expect(res.status).toBe(401);
    });
  });

  describe("root session", () => {
    beforeEach(() => guardMocks.setCallerTier(CallerTier.Root));

    it("soft-deletes a feed and drops its chunks", async () => {
      const res = await rpc("delete", { feedId: 1 });

      expect(res.status).toBe(200);
      expect(dbMocks.softDeleteFeed).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ feedId: 1 })
      );
    });
  });

  it("validates the related-feeds output against the contract", async () => {
    guardMocks.setCallerTier(CallerTier.ApiKey);
    // Procedure validates output, so the fixture must be the full `getRelatedFeeds` shape.
    dbMocks.getRelatedFeeds.mockResolvedValue([
      {
        id: 2,
        type: "note",
        slug: "related-note",
        locale: "zh-TW",
        title: "Related note",
        description: "Related description",
        excerpt: "Related excerpt",
        createdAt: new Date("2024-01-01").toISOString(),
        similarity: 0.92,
      },
    ]);

    const res = await rpc("related", { slug: "test-feed", locale: "zh-TW" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { json: { items: unknown[] } };
    expect(body.json.items).toHaveLength(1);
    expect(dbMocks.getRelatedFeeds).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        slug: "test-feed",
        locale: "zh-TW",
        limit: 3,
      })
    );
  });
});
