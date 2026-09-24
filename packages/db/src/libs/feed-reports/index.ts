import { and, count, desc, eq, gte, sql } from "drizzle-orm";

import type { DB } from "../../client.ts";
import {
  feedDrafts,
  feedReports,
  feeds,
  feedTranslations,
  user,
} from "../../schemas/schema.ts";
import type {
  FeedReport,
  FeedReportCategory,
  FeedReportStatus,
  FeedReportTriage,
  FeedType,
  Locale,
} from "../../schemas/schema.ts";
import { FEED_REPORT_STATUS } from "../../schemas/schema.ts";

export interface FeedReportInsert {
  feedId: number;
  locale: Locale;
  headingPath?: string | null;
  quote?: string | null;
  category: FeedReportCategory;
  claim: string;
  assessment: string;
  suggestion?: string | null;
  reporterId: string;
  sessionId?: string | null;
}

export const createFeedReport = async (
  db: DB,
  input: FeedReportInsert
): Promise<FeedReport> => {
  const [row] = await db.insert(feedReports).values(input).returning();
  if (!row) throw new Error("feed_report insert returned no row");
  return row;
};

/**
 * Takes the reporter's advisory lock on this transaction, so two sessions of one reader cannot
 * both pass the daily count before either inserts.
 */
export const lockFeedReporter = async (
  tx: DB,
  reporterId: string
): Promise<void> => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`feed_report.reporter:${reporterId}`}))`
  );
};

/** Reports `reporterId` filed at or after `since`, whatever became of them. */
export const countFeedReportsSince = async (
  db: DB,
  input: { reporterId: string; since: Date }
): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(feedReports)
    .where(
      and(
        eq(feedReports.reporterId, input.reporterId),
        gte(feedReports.createdAt, input.since)
      )
    );
  return row?.value ?? 0;
};

export const getFeedReport = async (
  db: DB,
  id: number
): Promise<FeedReport | undefined> => {
  const [row] = await db
    .select()
    .from(feedReports)
    .where(eq(feedReports.id, id))
    .limit(1);
  return row;
};

export const setFeedReportTriage = async (
  db: DB,
  id: number,
  triage: FeedReportTriage
): Promise<void> => {
  await db.update(feedReports).set({ triage }).where(eq(feedReports.id, id));
};

/** A report with what the operator needs beside it: the post, who filed it and the post's draft. */
export interface FeedReportRecord extends FeedReport {
  post: {
    slug: string;
    type: FeedType;
    /** In the report's locale; `null` when that translation is gone. */
    title: string | null;
  };
  reporter: { name: string; email: string } | null;
  /** The post's working draft, when one is open. */
  draftId: number | null;
}

const selectRecords = (db: DB) =>
  db
    .select({
      report: feedReports,
      slug: feeds.slug,
      type: feeds.type,
      title: feedTranslations.title,
      reporterName: user.name,
      reporterEmail: user.email,
      draftId: feedDrafts.id,
    })
    .from(feedReports)
    .innerJoin(feeds, eq(feeds.id, feedReports.feedId))
    .leftJoin(
      feedTranslations,
      and(
        eq(feedTranslations.feedId, feedReports.feedId),
        eq(feedTranslations.locale, feedReports.locale)
      )
    )
    .leftJoin(user, eq(user.id, feedReports.reporterId))
    .leftJoin(feedDrafts, eq(feedDrafts.feedId, feedReports.feedId))
    .$dynamic();

type SelectedRecord = Awaited<ReturnType<typeof selectRecords>>[number];

const toRecord = (row: SelectedRecord): FeedReportRecord => ({
  ...row.report,
  post: { slug: row.slug, type: row.type, title: row.title },
  reporter:
    row.reporterName === null || row.reporterEmail === null
      ? null
      : { name: row.reporterName, email: row.reporterEmail },
  draftId: row.draftId,
});

/** Newest first. Omit `status` for every report. */
export const listFeedReports = async (
  db: DB,
  input: { status?: FeedReportStatus; limit: number }
): Promise<FeedReportRecord[]> => {
  const rows = await selectRecords(db)
    .where(input.status ? eq(feedReports.status, input.status) : undefined)
    .orderBy(desc(feedReports.createdAt), desc(feedReports.id))
    .limit(input.limit);
  return rows.map(toRecord);
};

export const getFeedReportRecord = async (
  db: DB,
  id: number
): Promise<FeedReportRecord | undefined> => {
  const [row] = await selectRecords(db).where(eq(feedReports.id, id)).limit(1);
  return row ? toRecord(row) : undefined;
};

/** `false` when there is no such report. */
export const setFeedReportStatus = async (
  db: DB,
  id: number,
  status: FeedReportStatus
): Promise<boolean> => {
  const rows = await db
    .update(feedReports)
    .set({ status })
    .where(eq(feedReports.id, id))
    .returning({ id: feedReports.id });
  return rows.length > 0;
};

/** Called in the transaction that applies the post's draft; returns how many it resolved. */
export const resolveFeedReports = async (
  db: DB,
  feedId: number
): Promise<number> => {
  const rows = await db
    .update(feedReports)
    .set({ status: FEED_REPORT_STATUS.Resolved })
    .where(
      and(
        eq(feedReports.feedId, feedId),
        eq(feedReports.status, FEED_REPORT_STATUS.InProgress)
      )
    )
    .returning({ id: feedReports.id });
  return rows.length;
};
