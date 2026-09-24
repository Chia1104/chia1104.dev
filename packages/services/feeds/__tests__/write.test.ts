import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";

import { relations } from "@chia/db/schema";
import { FeedType, Locale } from "@chia/db/types";
import { normalizeAsciiSlug } from "@chia/utils/slug";

import { createFeedService } from "../write.service.ts";

describe("feed slug invariant", () => {
  it("normalizes an English phrase without inventing a translation", () => {
    expect(normalizeAsciiSlug("Embedding & RAG Architecture")).toBe(
      "embedding-rag-architecture"
    );
    expect(normalizeAsciiSlug("Embedding 與 RAG 架構")).toBeUndefined();
  });

  it("rejects a non-ASCII slug before touching the repository", async () => {
    const unreachableDb = drizzle.mock({ relations });
    await expect(
      createFeedService(
        unreachableDb,
        {
          adminId: "author-1",
          slug: "Embedding 與 RAG 架構",
          type: FeedType.Post,
          defaultLocale: Locale.ZhTW,
          translations: {
            [Locale.ZhTW]: { title: "RAG 架構" },
          },
        },
        {}
      )
    ).rejects.toThrow("Feed slug must be an English/ASCII phrase");
  });
});
