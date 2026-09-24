import { safe } from "@orpc/client";
import { beforeEach, describe, expect, it } from "vitest";

import { CallerTier } from "@chia/auth/tier";
import * as dbMocks from "@chia/test/mocks/db-feeds";

import * as guardMocks from "./helpers/guards";
import { client, errorCode } from "./helpers/rpc";

/** Visibility and dates take an API key; deletes need the operator session. */
describe("feeds writes require the right tier", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
    dbMocks.resetAllDbMocks();
  });

  describe("API key tier", () => {
    beforeEach(() => guardMocks.setCallerTier(CallerTier.ApiKey));

    it("may update a feed", async () => {
      await client.feeds.update({ feedId: 1, published: true });

      expect(dbMocks.updateFeed).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ feedId: 1, published: true })
      );
    });

    it("cannot write a post's content, which only applying a draft changes", async () => {
      // A variable, not an inline literal: excess-property checks would reject the key a stale caller still sends.
      const input = {
        feedId: 1,
        published: true,
        translations: { en: { content: "# bypass" } },
      };
      await client.feeds.update(input);

      expect(dbMocks.updateFeed).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({ translations: expect.anything() })
      );
      expect(dbMocks.upsertContent).not.toHaveBeenCalled();
    });

    it("may not delete a feed", async () => {
      const { error } = await safe(client.feeds.delete({ feedId: 1 }));

      expect(errorCode(error)).toBe("FORBIDDEN");
    });
  });

  describe("anonymous", () => {
    beforeEach(() => guardMocks.setCallerTier(CallerTier.Anonymous));

    // Input validation runs before the guard, so each case sends schema-valid input.
    it.each([
      ["update", () => client.feeds.update({ feedId: 1 })],
      ["delete", () => client.feeds.delete({ feedId: 1 })],
    ])("rejects %s outright", async (_procedure, call) => {
      const { error } = await safe(call());

      expect(errorCode(error)).toBe("UNAUTHORIZED");
    });
  });

  describe("root session", () => {
    beforeEach(() => guardMocks.setCallerTier(CallerTier.Root));

    it("soft-deletes a feed and drops its chunks", async () => {
      await client.feeds.delete({ feedId: 1 });

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

    const data = await client.feeds.related({
      slug: "test-feed",
      locale: "zh-TW",
    });

    expect(data.items).toHaveLength(1);
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
