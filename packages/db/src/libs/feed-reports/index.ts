import { and, count, eq, gte, sql } from "drizzle-orm";

import type { DB } from "../../client.ts";
import { feedReports } from "../../schemas/schema.ts";
import type {
  FeedReport,
  FeedReportCategory,
  FeedReportTriage,
  Locale,
} from "../../schemas/schema.ts";

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
