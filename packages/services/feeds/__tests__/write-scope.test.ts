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

const media = vi.hoisted(() => ({
  getMediaEntry: vi.fn(async (_db: DB, id: number) =>
    id === 25 ? { id } : undefined
  ),
}));

const tags = vi.hoisted(() => ({
  findTagIds: vi.fn(async (_db: DB, ids: number[]) =>
    ids.filter((id) => id !== 99)
  ),
  setFeedTags: vi.fn(),
}));

vi.mock("@chia/db/repos/feeds", () => feeds);
vi.mock("@chia/db/repos/media", () => media);
vi.mock("@chia/db/repos/tags", () => tags);

import { updateFeedService } from "../write.service";

/* SAFETY: the repositories are mocked; the handle is only passed through to them. */
const db = {} as DB;

const stored = (
  title: string,
  mediaEntryId: number | null = null,
  content: string | null = "Body"
) => ({
  mediaEntryId,
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
      content,
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
    feeds.updateFeed.mockClear();
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

  it("sets the work a feed is about and reports a listing change, since the work's page lists it", async () => {
    feeds.getFeedForIndexing
      .mockResolvedValueOnce(stored("RAG"))
      .mockResolvedValueOnce(stored("RAG", 25));
    const onFeedChanged = vi.fn(async () => undefined);

    await updateFeedService(
      db,
      { feedId: 5, mediaEntryId: 25 },
      { onFeedChanged }
    );

    expect(feeds.updateFeed).toHaveBeenCalledExactlyOnceWith(
      db,
      expect.objectContaining({ feedId: 5, mediaEntryId: 25 })
    );
    expect(onFeedChanged).toHaveBeenCalledExactlyOnceWith(
      5,
      FeedChangeScope.Listing
    );
  });

  it("refuses a work that is not logged, before writing the feed", async () => {
    await expect(
      updateFeedService(db, { feedId: 5, mediaEntryId: 99 }, {})
    ).rejects.toThrow("No logged work has id 99");
    expect(feeds.updateFeed).not.toHaveBeenCalled();
  });

  it("reports a listing change when a translation gains its first body, since lists only hold feeds with one", async () => {
    feeds.getFeedForIndexing
      .mockResolvedValueOnce(stored("RAG", null, null))
      .mockResolvedValueOnce(stored("RAG"));
    const onFeedChanged = vi.fn(async () => undefined);

    await updateFeedService(db, applyTitle("RAG"), { onFeedChanged });

    expect(onFeedChanged).toHaveBeenCalledExactlyOnceWith(
      5,
      FeedChangeScope.Listing
    );
  });

  it("refuses an unknown tag before writing the feed", async () => {
    await expect(
      updateFeedService(
        db,
        { feedId: 5, published: false, tagIds: [3, 99] },
        {}
      )
    ).rejects.toThrow("No tag has id 99");
    expect(feeds.updateFeed).not.toHaveBeenCalled();
    expect(tags.setFeedTags).not.toHaveBeenCalled();
  });

  it("skips the listing reads when no hook listens", async () => {
    await updateFeedService(db, applyTitle("RAG"), {});

    expect(feeds.getFeedForIndexing).not.toHaveBeenCalled();
  });
});
