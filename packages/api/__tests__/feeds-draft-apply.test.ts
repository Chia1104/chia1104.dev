import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";

import type { UpdateFeedServiceInput } from "../feeds/write";
import type { FeedHooks } from "../orpc/utils";

/**
 * Applying a draft commits exactly the revision the caller approved: the row is locked and
 * checked in the transaction that writes the feed, and feed hooks fire only after it commits.
 */

const repo = vi.hoisted(() => ({
  getFeedDraftForUpdate: vi.fn(),
  markFeedDraftApplied: vi.fn(async () => undefined),
}));
const write = vi.hoisted(() => ({
  createFeedService: vi.fn(),
  updateFeedService: vi.fn(),
}));

vi.mock("@chia/db/repos/drafts", () => repo);
vi.mock("@chia/db/repos/feeds", () => ({ getFeedForIndexing: vi.fn() }));
vi.mock("../feeds/write", () => write);

import { applyFeedDraftService } from "../feeds/draft";

/** Whether the transaction is open; hooks must observe it closed. */
let inTransaction = false;

/** Whatever the transaction callback returns; the fake passes it through untouched. */
type Applied = object;

const db: DB =
  /* SAFETY: the repositories are mocked; only `transaction` is called on the handle. */ {
    transaction: async (fn: (tx: DB) => Promise<Applied>) => {
      inTransaction = true;
      try {
        return await fn(db);
      } finally {
        inTransaction = false;
      }
    },
  } as never;

const draft = (revision: number) => ({
  id: 7,
  userId: "admin",
  feedId: 5,
  revision,
  appliedRevision: null,
  slug: "a-post",
  type: "post",
  defaultLocale: "en",
  mainImage: null,
  translations: {
    en: {
      title: "A post",
      excerpt: null,
      description: null,
      summary: null,
      content: "## Body",
    },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  inTransaction = false;
  write.updateFeedService.mockResolvedValue({ id: 5, slug: "a-post" });
});

describe("applyFeedDraftService", () => {
  it("refuses a draft whose locked revision is not the approved one, before touching the feed", async () => {
    repo.getFeedDraftForUpdate.mockResolvedValue(draft(4));

    await expect(
      applyFeedDraftService(
        db,
        { draftId: 7, adminId: "admin", expectedRevision: 3 },
        {}
      )
    ).rejects.toMatchObject({ code: "CONFLICT", data: { revision: 4 } });

    expect(write.updateFeedService).not.toHaveBeenCalled();
    expect(repo.markFeedDraftApplied).not.toHaveBeenCalled();
  });

  it("applies the approved revision under the lock and fires feed hooks after the commit", async () => {
    repo.getFeedDraftForUpdate.mockResolvedValue(draft(3));
    const onFeedChanged = vi.fn(async () => {
      expect(inTransaction).toBe(false);
    });
    write.updateFeedService.mockImplementation(
      async (_db: DB, _input: UpdateFeedServiceInput, hooks: FeedHooks) => {
        expect(inTransaction).toBe(true);
        await hooks.onFeedChanged?.(5);
        return { id: 5, slug: "a-post" };
      }
    );

    const result = await applyFeedDraftService(
      db,
      { draftId: 7, adminId: "admin", expectedRevision: 3 },
      { onFeedChanged }
    );

    expect(result).toEqual({ feedId: 5, slug: "a-post", created: false });
    expect(repo.markFeedDraftApplied).toHaveBeenCalledWith(db, {
      draftId: 7,
      feedId: 5,
      revision: 3,
    });
    expect(onFeedChanged).toHaveBeenCalledExactlyOnceWith(5);
  });

  it("applies whatever revision is current when none was approved", async () => {
    repo.getFeedDraftForUpdate.mockResolvedValue(draft(9));

    await applyFeedDraftService(db, { draftId: 7, adminId: "admin" }, {});

    expect(repo.markFeedDraftApplied).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ revision: 9 })
    );
  });
});
