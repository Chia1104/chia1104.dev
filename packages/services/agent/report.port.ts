import type { ReportPort } from "@chia/agent-public/ports";
import type { DB } from "@chia/db/client";
import {
  countFeedReportsSince,
  createFeedReport,
} from "@chia/db/repos/feed-reports";
import { getFeedBySlug } from "@chia/db/repos/feeds";
import type { FeedReport } from "@chia/db/schema";
import { AppError } from "@chia/service-kit/errors";

/** Per reporter over a rolling day; reports cost the operator's attention, not the reader's quota. */
export const FEED_REPORT_DAILY_LIMIT = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CreateReportPortOptions {
  db: DB;
  /** Whose posts can be reported. */
  authorId: string;
  /** The session's signed-in owner; the host never builds this port for a guest. */
  reporterId: string;
  sessionId: string;
  /** Runs after the row is written; a failure is the caller's to report, not the reader's. */
  onReported?: (report: FeedReport) => Promise<void>;
}

export const createReportPort = (
  options: CreateReportPortOptions
): ReportPort => ({
  async submit(input) {
    const { db } = options;
    const recent = await countFeedReportsSince(db, {
      reporterId: options.reporterId,
      since: new Date(Date.now() - DAY_MS),
    });
    if (recent >= FEED_REPORT_DAILY_LIMIT) {
      throw new AppError("TOO_MANY_REQUESTS", {
        message: `This visitor already sent ${FEED_REPORT_DAILY_LIMIT} reports today. Tell them to try again tomorrow.`,
      });
    }

    const feed = await getFeedBySlug(db, {
      slug: input.slug,
      userId: options.authorId,
      published: true,
    });
    if (!feed) {
      throw new AppError("NOT_FOUND", {
        message: `No published post has the slug "${input.slug}". Use the slug a tool returned.`,
      });
    }

    const report = await createFeedReport(db, {
      feedId: feed.id,
      locale: input.locale,
      headingPath: input.headingPath ?? null,
      quote: input.quote ?? null,
      category: input.category,
      claim: input.claim,
      assessment: input.assessment,
      reporterId: options.reporterId,
      sessionId: options.sessionId,
    });
    await options.onReported?.(report);
    return { id: report.id };
  },
});
