import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";

/**
 * Discarding decides on a content hash. An unbound draft is deleted under its row lock, so a
 * write that lands after the caller looked is a conflict rather than work deleted unseen.
 */

const repo = vi.hoisted(() => ({
  deleteUnboundFeedDraft: vi.fn(),
  getFeedDraftRevision: vi.fn(),
  replaceFeedDraft: vi.fn(),
  snapshotOfRevision: vi.fn(
    (revision: { snapshot: object }) => revision.snapshot
  ),
}));

vi.mock("@chia/db/repos/drafts", () => repo);
vi.mock("@chia/db/repos/feeds", () => ({ getFeedForIndexing: vi.fn() }));
vi.mock("../write.service", () => ({
  createFeedService: vi.fn(),
  updateFeedService: vi.fn(),
}));

import { discardFeedDraftService } from "../draft.service";

// SAFETY: the repositories are mocked; the handle is only passed through.
const db = {} as DB;
const input = { draftId: 7, adminId: "admin", expectedHash: "seen" };
interface LockedDraft {
  id: number;
  userId: string;
  feedId: number | null;
  revision: number;
  contentHash: string;
  appliedRevisionId: number | null;
}

const draft = (overrides: Partial<LockedDraft> = {}): LockedDraft => ({
  id: 7,
  userId: "admin",
  feedId: null,
  revision: 4,
  contentHash: "seen",
  appliedRevisionId: null,
  ...overrides,
});

describe("discardFeedDraftService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes an unbound draft that still holds what the caller saw", async () => {
    repo.deleteUnboundFeedDraft.mockResolvedValue({ status: "deleted" });

    await discardFeedDraftService(db, input);

    expect(repo.deleteUnboundFeedDraft).toHaveBeenCalledWith(db, {
      draftId: 7,
      userId: "admin",
      expectedHash: "seen",
    });
    expect(repo.replaceFeedDraft).not.toHaveBeenCalled();
  });

  it("refuses when the draft was written after the caller looked", async () => {
    repo.deleteUnboundFeedDraft.mockResolvedValue({
      status: "conflict",
      draft: draft({ revision: 5, contentHash: "newer" }),
    });

    await expect(discardFeedDraftService(db, input)).rejects.toMatchObject({
      code: "CONFLICT",
      data: { revision: 5, contentHash: "newer" },
    });
  });

  it("restores the applied commit when the draft has a post", async () => {
    repo.deleteUnboundFeedDraft.mockResolvedValue({
      status: "bound",
      draft: draft({ feedId: 5, appliedRevisionId: 31 }),
    });
    repo.getFeedDraftRevision.mockResolvedValue({ snapshot: { slug: "a" } });
    repo.replaceFeedDraft.mockResolvedValue({ status: "ok", draft: draft() });

    await discardFeedDraftService(db, input);

    expect(repo.getFeedDraftRevision).toHaveBeenCalledWith(db, {
      draftId: 7,
      revisionId: 31,
      userId: "admin",
    });
    expect(repo.replaceFeedDraft).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ expectedHash: "seen", snapshot: { slug: "a" } })
    );
  });

  it("answers NOT_FOUND for a draft that is gone or someone else's", async () => {
    repo.deleteUnboundFeedDraft.mockResolvedValue({ status: "not_found" });

    await expect(discardFeedDraftService(db, input)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
