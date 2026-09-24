import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import { FeedReportCategory } from "@chia/db/schema";
import { Locale } from "@chia/db/types";
import { AppErrorCode } from "@chia/service-kit/errors";

import { createReportPort, FEED_REPORT_DAILY_LIMIT } from "../report.port";

const { reports, feeds } = vi.hoisted(() => ({
  reports: {
    countFeedReportsSince: vi.fn(),
    createFeedReport: vi.fn(),
    lockFeedReporter: vi.fn(() => Promise.resolve()),
  },
  feeds: { getFeedBySlug: vi.fn() },
}));

vi.mock("@chia/db/repos/feed-reports", () => reports);
vi.mock("@chia/observability/report", () => ({ reportError: vi.fn() }));
vi.mock("@chia/db/repos/feeds", () => feeds);
vi.mock("@chia/observability/report", () => ({ reportError: vi.fn() }));

/** Whatever the transaction callback returns; the fake passes it through untouched. */
type Filed = object;

const db: DB =
  /* SAFETY: the repositories are mocked; only `transaction` is called on the handle. */ {
    transaction: (fn: (tx: DB) => Promise<Filed>) => fn(db),
  } as never;

const input = {
  slug: "hello-world",
  locale: Locale.En,
  category: FeedReportCategory.Typo,
  claim: '"teh" in the intro.',
  assessment: 'The intro does say "teh".',
};

const port = (onReported?: () => Promise<void>) =>
  createReportPort({
    db,
    authorId: "author",
    reporterId: "reader",
    sessionId: "session-1",
    onReported,
  });

describe("createReportPort", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("files a report on the author's published post as the reader", async () => {
    reports.countFeedReportsSince.mockResolvedValueOnce(0);
    feeds.getFeedBySlug.mockResolvedValueOnce({ id: 3 });
    const row = { id: 11 };
    reports.createFeedReport.mockResolvedValueOnce(row);
    const onReported = vi.fn(() => Promise.resolve());

    await expect(port(onReported).submit(input)).resolves.toEqual({ id: 11 });
    expect(feeds.getFeedBySlug).toHaveBeenCalledWith(db, {
      slug: "hello-world",
      userId: "author",
      published: true,
    });
    expect(reports.createFeedReport).toHaveBeenCalledWith(db, {
      feedId: 3,
      locale: Locale.En,
      headingPath: null,
      quote: null,
      category: FeedReportCategory.Typo,
      claim: input.claim,
      assessment: input.assessment,
      suggestion: null,
      reporterId: "reader",
      sessionId: "session-1",
    });
    expect(reports.lockFeedReporter).toHaveBeenCalledWith(db, "reader");
    expect(onReported).toHaveBeenCalledWith(row);
  });

  it("returns the filed report even when its follow-up fails", async () => {
    reports.countFeedReportsSince.mockResolvedValueOnce(0);
    feeds.getFeedBySlug.mockResolvedValueOnce({ id: 3 });
    reports.createFeedReport.mockResolvedValueOnce({ id: 12 });

    await expect(
      port(() => Promise.reject(new Error("workflow down"))).submit(input)
    ).resolves.toEqual({ id: 12 });
  });

  it("refuses a reader over the daily limit before looking anything up", async () => {
    reports.countFeedReportsSince.mockResolvedValueOnce(
      FEED_REPORT_DAILY_LIMIT
    );

    await expect(port().submit(input)).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    expect(feeds.getFeedBySlug).not.toHaveBeenCalled();
  });

  it("refuses a slug that is not a published post", async () => {
    reports.countFeedReportsSince.mockResolvedValueOnce(0);
    feeds.getFeedBySlug.mockResolvedValueOnce(undefined);

    await expect(port().submit(input)).rejects.toMatchObject({
      code: AppErrorCode.NotFound,
    });
    expect(reports.createFeedReport).not.toHaveBeenCalled();
  });
});
