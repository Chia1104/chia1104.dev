import { describe, expect, it } from "vitest";
import type { DB } from "@chia/db/client";
import { FeedType, Locale } from "@chia/db/types";
import { normalizeAsciiSlug } from "@chia/utils/slug";

import { createFeedService } from "../feeds/write.ts";
import { createFeedSchema } from "../orpc/contracts/feeds.contract.ts";

describe("feed slug invariant", () => {
  it("requires an explicit slug at the API contract", () => {
    expect(
      createFeedSchema.safeParse({
        type: FeedType.Post,
        translations: {
          [Locale.zhTW]: { title: "RAG 架構" },
        },
      }).success
    ).toBe(false);
  });

  it("normalizes an English phrase without inventing a translation", () => {
    expect(normalizeAsciiSlug("Embedding & RAG Architecture")).toBe(
      "embedding-rag-architecture"
    );
    expect(normalizeAsciiSlug("Embedding 與 RAG 架構")).toBeUndefined();
  });

  it("rejects a non-ASCII slug before touching the repository", async () => {
    // SAFETY: Slug validation rejects before the service can access the database.
    const unreachableDb = {} as DB;
    await expect(
      createFeedService(
        unreachableDb,
        {
          adminId: "author-1",
          slug: "Embedding 與 RAG 架構",
          type: FeedType.Post,
          defaultLocale: Locale.zhTW,
          translations: {
            [Locale.zhTW]: { title: "RAG 架構" },
          },
        },
        {}
      )
    ).rejects.toThrow("Feed slug must be an English/ASCII phrase");
  });
});
