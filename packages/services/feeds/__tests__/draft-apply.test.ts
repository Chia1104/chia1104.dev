const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));

vi.mock("@chia/observability/report", () => ({ reportError }));

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import { FeedType, Locale } from "@chia/db/types";
import { AppErrorCode } from "@chia/service-kit/errors";

import type { FeedHooks } from "../../shared/context";
import type { UpdateFeedServiceInput } from "../write.service";

/**
 * Applying a draft commits exactly the content the caller decided on: the row is locked and
 * its hash checked in the transaction that writes the feed, and feed hooks fire only after it
 * commits.
 */

const repo = vi.hoisted(() => ({
  getFeedDraftForUpdate: vi.fn(),
  commitFeedDraft: vi.fn(async () => ({ id: 31, contentHash: "h3" })),
}));
const reports = vi.hoisted(() => ({
  resolveFeedReports: vi.fn(async () => {
    expect(inTransaction).toBe(true);
    return 1;
  }),
}));
const write = vi.hoisted(() => ({
  createFeedService: vi.fn(),
  updateFeedService: vi.fn(),
}));

vi.mock("@chia/db/repos/drafts", () => repo);
vi.mock("@chia/db/repos/feed-reports", () => reports);
vi.mock("@chia/db/repos/feeds", () => ({ getFeedForIndexing: vi.fn() }));
vi.mock("../write.service", () => write);

import { applyFeedDraftService } from "../draft.service";

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
  contentHash: `h${revision}`,
  appliedRevisionId: null,
  appliedHash: null,
  slug: "a-post",
  type: FeedType.Post,
  defaultLocale: Locale.En,
  mainImage: null,
  translations: {
    en: {
      title: "A post",
      excerpt: null,
      description: null,
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
  it("refuses a draft whose locked content is not what was decided on, before touching the feed", async () => {
    repo.getFeedDraftForUpdate.mockResolvedValue(draft(4));

    await expect(
      applyFeedDraftService(
        db,
        { draftId: 7, adminId: "admin", expectedHash: "h3" },
        {}
      )
    ).rejects.toMatchObject({
      code: AppErrorCode.Conflict,
      data: { revision: 4, contentHash: "h4" },
    });

    expect(write.updateFeedService).not.toHaveBeenCalled();
    expect(repo.commitFeedDraft).not.toHaveBeenCalled();
    expect(reports.resolveFeedReports).not.toHaveBeenCalled();
  });

  it("applies the decided content under the lock, commits it and fires feed hooks after the transaction", async () => {
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
      {
        draftId: 7,
        adminId: "admin",
        expectedHash: "h3",
        message: "Tighten the intro",
      },
      { onFeedChanged }
    );

    expect(result).toEqual({
      feedId: 5,
      slug: "a-post",
      created: false,
      revisionId: 31,
      contentHash: "h3",
    });
    expect(repo.commitFeedDraft).toHaveBeenCalledWith(db, {
      draft: expect.objectContaining({ id: 7, contentHash: "h3" }),
      feedId: 5,
      message: "Tighten the intro",
    });
    expect(onFeedChanged).toHaveBeenCalledExactlyOnceWith(5);
    expect(reports.resolveFeedReports).toHaveBeenCalledExactlyOnceWith(db, 5);
  });

  it("reports the committed apply even when the feed hook fails afterwards", async () => {
    repo.getFeedDraftForUpdate.mockResolvedValue(draft(3));
    const onFeedChanged = vi.fn(async () => {
      throw new Error("indexing service down");
    });
    write.updateFeedService.mockImplementation(
      async (_db: DB, _input: UpdateFeedServiceInput, hooks: FeedHooks) => {
        await hooks.onFeedChanged?.(5);
        return { id: 5, slug: "a-post" };
      }
    );
    reportError.mockClear();

    await expect(
      applyFeedDraftService(
        db,
        { draftId: 7, adminId: "admin", expectedHash: "h3" },
        { onFeedChanged }
      )
    ).resolves.toMatchObject({ feedId: 5, slug: "a-post", created: false });

    expect(onFeedChanged).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledOnce();
  });
});
