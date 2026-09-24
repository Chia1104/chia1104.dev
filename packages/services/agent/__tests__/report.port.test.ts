import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";

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
vi.mock("@chia/db/repos/feeds", () => feeds);

/** Whatever the transaction callback returns; the fake passes it through untouched. */
type Filed = object;

const db: DB =
  /* SAFETY: the repositories are mocked; only `transaction` is called on the handle. */ {
    transaction: (fn: (tx: DB) => Promise<Filed>) => fn(db),
  } as never;

const input = {
  slug: "hello-world",
  locale: "en" as const,
  category: "typo" as const,
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
      locale: "en",
      headingPath: null,
      quote: null,
      category: "typo",
      claim: input.claim,
      assessment: input.assessment,
      suggestion: null,
      reporterId: "reader",
      sessionId: "session-1",
    });
    expect(reports.lockFeedReporter).toHaveBeenCalledWith(db, "reader");
    expect(onReported).toHaveBeenCalledWith(row);
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
      code: "NOT_FOUND",
    });
    expect(reports.createFeedReport).not.toHaveBeenCalled();
  });
});
