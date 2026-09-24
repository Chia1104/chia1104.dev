import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import type { FeedReportRecord } from "@chia/db/repos/feed-reports";
import {
  FeedDraftAuthor,
  FeedReportCategory,
  FeedReportStatus,
  FeedReportVerdict,
} from "@chia/db/schema";
import { FeedType, Locale } from "@chia/db/types";
import { AppErrorCode } from "@chia/service-kit/errors";

const { reports, drafts } = vi.hoisted(() => ({
  reports: {
    getFeedReportRecord: vi.fn(),
    setFeedReportStatus: vi.fn(async () => true),
  },
  drafts: {
    openFeedDraftService: vi.fn(async () => ({ id: 9, revision: 4 })),
    patchFeedDraftService: vi.fn(async () => ({ id: 9, revision: 5 })),
  },
}));

vi.mock("@chia/db/repos/feed-reports", () => reports);
vi.mock("../../feeds/draft.service", () => drafts);

const { applyReportEditsService } = await import("../report.service");

/** Whatever the transaction callback returns; the fake passes it through untouched. */
type Applied = object;

const db: DB =
  /* SAFETY: every repository and service the function reaches is mocked; only `transaction` is called on the handle. */ {
    transaction: (fn: (tx: DB) => Promise<Applied>) => fn(db),
  } as never;

const record = (
  edits: NonNullable<FeedReportRecord["triage"]>["edits"],
  status: FeedReportRecord["status"] = FeedReportStatus.Open
): FeedReportRecord => ({
  id: 1,
  feedId: 5,
  locale: Locale.En,
  headingPath: null,
  quote: null,
  category: FeedReportCategory.Typo,
  claim: "teh",
  assessment: "It says teh.",
  suggestion: "the",
  reporterId: "reader",
  sessionId: "session-1",
  status,
  triage: {
    verdict: FeedReportVerdict.LikelyValid,
    summary: "錯字。",
    edits,
    droppedEdits: 0,
  },
  post: { slug: "a-post", type: FeedType.Post, title: "A post" },
  reporter: null,
  draftId: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("applyReportEditsService", () => {
  it("patches every locale's suggestions against the revision it opened, then takes the report up", async () => {
    reports.getFeedReportRecord.mockResolvedValue(
      record([
        { locale: Locale.En, find: "teh", replace: "the" },
        { locale: Locale.ZhTW, find: "錯自", replace: "錯字" },
        { locale: Locale.En, find: "recieve", replace: "receive" },
      ])
    );

    await expect(
      applyReportEditsService(db, { id: 1, adminId: "admin" })
    ).resolves.toMatchObject({ draftId: 9 });

    expect(drafts.openFeedDraftService).toHaveBeenCalledWith(db, {
      adminId: "admin",
      feedId: 5,
      author: FeedDraftAuthor.Operator,
    });
    expect(drafts.patchFeedDraftService).toHaveBeenCalledWith(db, {
      draftId: 9,
      adminId: "admin",
      expectedRevision: 4,
      author: FeedDraftAuthor.Operator,
      edits: {
        [Locale.En]: [
          { oldString: "teh", newString: "the" },
          { oldString: "recieve", newString: "receive" },
        ],
        [Locale.ZhTW]: [{ oldString: "錯自", newString: "錯字" }],
      },
    });
    expect(reports.setFeedReportStatus).toHaveBeenCalledWith(
      db,
      1,
      FeedReportStatus.InProgress
    );
  });

  it("refuses a report with nothing to apply, before opening a draft", async () => {
    reports.getFeedReportRecord.mockResolvedValue(record([]));

    await expect(
      applyReportEditsService(db, { id: 1, adminId: "admin" })
    ).rejects.toMatchObject({ code: AppErrorCode.BadRequest });
    expect(drafts.openFeedDraftService).not.toHaveBeenCalled();
  });

  it("refuses a settled report rather than reopening it through the draft", async () => {
    reports.getFeedReportRecord.mockResolvedValue(
      record(
        [{ locale: Locale.En, find: "teh", replace: "the" }],
        FeedReportStatus.Dismissed
      )
    );

    await expect(
      applyReportEditsService(db, { id: 1, adminId: "admin" })
    ).rejects.toMatchObject({ code: AppErrorCode.BadRequest });
    expect(drafts.openFeedDraftService).not.toHaveBeenCalled();
  });

  it("leaves the report open when the draft refuses the patch", async () => {
    reports.getFeedReportRecord.mockResolvedValue(
      record([{ locale: Locale.En, find: "teh", replace: "the" }])
    );
    drafts.patchFeedDraftService.mockRejectedValueOnce(
      new Error("Edit 1 of 1 was not applied")
    );

    await expect(
      applyReportEditsService(db, { id: 1, adminId: "admin" })
    ).rejects.toThrow("not applied");
    expect(reports.setFeedReportStatus).not.toHaveBeenCalled();
  });
});
