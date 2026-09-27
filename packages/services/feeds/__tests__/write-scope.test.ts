import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import { FeedType, Locale } from "@chia/db/types";
import { FeedChangeScope } from "@chia/workflow-control/contract";

/**
 * An update names the www pages it changed: only its article when what listings show is
 * untouched, every listing otherwise. An apply sends every title, so the scope comes from the
 * stored feed before and after the write, not from the input.
 */

const feeds = vi.hoisted(() => ({
  createFeed: vi.fn(),
  getFeedForIndexing: vi.fn(),
  updateFeed: vi.fn(async () => ({ id: 5 })),
  upsertFeedTranslation: vi.fn(async () => ({ id: 50 })),
  upsertContent: vi.fn(async () => ({ id: 500 })),
}));

vi.mock("@chia/db/repos/feeds", () => feeds);
vi.mock("@chia/db/repos/tags", () => ({
  findTagIds: vi.fn(),
  setFeedTags: vi.fn(),
}));

import { updateFeedService } from "../write.service";

/* SAFETY: the repositories are mocked; the handle is only passed through to them. */
const db = {} as DB;

const stored = (title: string) => ({
  id: 5,
  slug: "a-post",
  type: FeedType.Post,
  published: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  deletedAt: null,
  defaultLocale: Locale.ZhTW,
  tags: [{ locale: Locale.ZhTW, name: "RAG" }],
  translations: [
    {
      id: 50,
      locale: Locale.ZhTW,
      title,
      excerpt: null,
      description: "About RAG",
      summary: null,
      content: "Body",
    },
  ],
});

const applyTitle = (title: string) => ({
  feedId: 5,
  translations: { [Locale.ZhTW]: { title, content: "A new body" } },
});

describe("updateFeedService scope", () => {
  beforeEach(() => {
    feeds.getFeedForIndexing.mockReset();
  });

  it("reports an article change when listings show the same feed", async () => {
    feeds.getFeedForIndexing
      .mockResolvedValueOnce(stored("RAG"))
      .mockResolvedValueOnce(stored("RAG"));
    const onFeedChanged = vi.fn(async () => undefined);

    await updateFeedService(db, applyTitle("RAG"), { onFeedChanged });

    expect(onFeedChanged).toHaveBeenCalledExactlyOnceWith(
      5,
      FeedChangeScope.Article
    );
  });

  it("reports a listing change when a listed field changed", async () => {
    feeds.getFeedForIndexing
      .mockResolvedValueOnce(stored("RAG"))
      .mockResolvedValueOnce(stored("RAG, revisited"));
    const onFeedChanged = vi.fn(async () => undefined);

    await updateFeedService(db, applyTitle("RAG, revisited"), {
      onFeedChanged,
    });

    expect(onFeedChanged).toHaveBeenCalledExactlyOnceWith(
      5,
      FeedChangeScope.Listing
    );
  });

  it("skips the listing reads when no hook listens", async () => {
    await updateFeedService(db, applyTitle("RAG"), {});

    expect(feeds.getFeedForIndexing).not.toHaveBeenCalled();
  });
});
