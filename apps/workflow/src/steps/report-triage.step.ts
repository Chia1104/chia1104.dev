import "zod/compile";
import {
  buildReportTriagePrompt,
  parseReportTriage,
} from "@chia/agent-host/report-triage";
import { AgentTaskId, resolveAgentTask } from "@chia/agent-host/tasks";
import { FEED_TASK_USAGE_KIND, recordAgentUsage } from "@chia/agent-host/usage";
import { connectDatabase } from "@chia/db/client";
import type { DB } from "@chia/db/client";
import {
  getFeedReport,
  setFeedReportTriage,
} from "@chia/db/repos/feed-reports";
import { getFeedForIndexing } from "@chia/db/repos/feeds";
import {
  AgentCredentialSource,
  AgentUsageSource,
  FeedReportVerdict,
} from "@chia/db/schema";
import type { FeedReport } from "@chia/db/schema";
import type { Locale } from "@chia/db/types";
import { env as emailEnv } from "@chia/integrations/email/env";
import type { ReportEmail } from "@chia/integrations/email/report";
import { logger } from "@chia/observability/logger";
import { reportError } from "@chia/observability/report";
import { DASH_BASE_URL, feedUrl } from "@chia/utils/config";

const TRIAGE_TIMEOUT_MS = 120_000;

/** A failure leaves `feed_report.triage` empty; the workflow still notifies the operator. */
export const ReportTriageStatus = {
  Ok: "ok",
  /** The report or its post is gone; nothing to triage and nobody to notify. */
  ReportGone: "report_gone",
  /** The post was unpublished or deleted since the report was filed; its bodies are not what readers see. */
  PostUnpublished: "post_unpublished",
  NoReply: "no_reply",
  UnreadableReply: "unreadable_reply",
  Failed: "failed",
} as const;

export type ReportTriageStatus =
  (typeof ReportTriageStatus)[keyof typeof ReportTriageStatus];

export const ReportNotifyStatus = {
  Sent: "sent",
  ReportGone: "report_gone",
  NoEmailKey: "no_email_key",
} as const;

export type ReportNotifyStatus =
  (typeof ReportNotifyStatus)[keyof typeof ReportNotifyStatus];

type TriageFeed = NonNullable<Awaited<ReturnType<typeof getFeedForIndexing>>>;

const runTriage = async (
  db: DB,
  report: FeedReport,
  feed: TriageFeed
): Promise<ReportTriageStatus> => {
  const { completeText } = await import("@chia/agent-runtime/complete");
  const task = await resolveAgentTask(db, AgentTaskId.ReportTriage);

  const reply = await completeText({
    models: task.models,
    model: task.model,
    // SAFETY: the definition carries a prompt, so `resolveAgentTask` always returns one.
    systemPrompt: task.systemPrompt!,
    text: await buildReportTriagePrompt(report, feed.translations),
    ...task.params,
    signal: AbortSignal.timeout(TRIAGE_TIMEOUT_MS),
    // The house pays; the post's author is who it was for.
    onUsage: (usage) =>
      recordAgentUsage(db, {
        userId: feed.userId,
        kind: FEED_TASK_USAGE_KIND,
        source: AgentUsageSource.Triage,
        credentialSource: AgentCredentialSource.House,
        ...usage,
      }),
  });
  if (reply === null) return ReportTriageStatus.NoReply;

  const bodies: Partial<Record<Locale, string>> = Object.fromEntries(
    feed.translations
      .filter((translation) => translation.content)
      .map((translation) => [translation.locale, translation.content])
  );
  const triage = parseReportTriage(reply, bodies);
  if (!triage) return ReportTriageStatus.UnreadableReply;

  await setFeedReportTriage(db, report.id, triage);
  logger.info(
    {
      reportId: report.id,
      verdict: triage.verdict,
      edits: triage.edits.length,
      droppedEdits: triage.droppedEdits,
    },
    "Reader report triaged"
  );
  return ReportTriageStatus.Ok;
};

/**
 * One model call that writes `feed_report.triage`. Nothing here throws past the step: a
 * failed read or triage leaves the column empty and the report still reaches the operator.
 * Runtime is imported at first use: this step is registered at boot and the runtime carries
 * the provider stack.
 */
export const triageReportStep = async (
  reportId: number
): Promise<ReportTriageStatus> => {
  "use step";

  try {
    const db = await connectDatabase(undefined, { withCache: false });
    const report = await getFeedReport(db, reportId);
    if (!report) return ReportTriageStatus.ReportGone;
    const feed = await getFeedForIndexing(db, { feedId: report.feedId });
    if (!feed) return ReportTriageStatus.ReportGone;
    if (!feed.published || feed.deletedAt) {
      return ReportTriageStatus.PostUnpublished;
    }
    return await runTriage(db, report, feed);
  } catch (error) {
    reportError(error, "Reader report triage failed", { reportId });
    return ReportTriageStatus.Failed;
  }
};

/** A retry would bill the model call again; the operator can read the report without it. */
triageReportStep.maxRetries = 0;

const VERDICT_LABELS = {
  [FeedReportVerdict.LikelyValid]: "Likely valid",
  [FeedReportVerdict.NeedsVerification]: "Needs verification",
  [FeedReportVerdict.NotValid]: "Not valid",
} satisfies Record<FeedReportVerdict, string>;

/** Reader text is indented as a quote so it reads as cited, never as the message itself. */
const quote = (text: string): string =>
  text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");

export const buildReportEmail = (
  report: FeedReport,
  post: { title: string; url: string }
): ReportEmail => {
  const { triage } = report;
  const lines = [
    `A reader reported a ${report.category} in "${post.title}" (${report.locale}).`,
    post.url,
    report.headingPath ? `Section: ${report.headingPath}` : null,
    "",
    report.quote ? `Passage:\n${quote(report.quote)}\n` : null,
    `Reader's claim:\n${quote(report.claim)}`,
    "",
    `Reader agent's assessment:\n${quote(report.assessment)}`,
    "",
    report.suggestion ? `Suggested fix:\n${quote(report.suggestion)}\n` : null,
    triage
      ? [
          `Triage: ${VERDICT_LABELS[triage.verdict]}`,
          quote(triage.summary),
          triage.edits.length > 0
            ? `${triage.edits.length} suggested edit(s) are waiting in the dashboard.`
            : null,
        ]
          .filter((line) => line !== null)
          .join("\n")
      : "Triage did not run; review the report by hand.",
    "",
    `Review: ${DASH_BASE_URL}/reports/${report.id}`,
  ];
  return {
    subject: `[Reader report] ${post.title}`,
    text: lines.filter((line) => line !== null).join("\n"),
  };
};

/** Emails the operator. Retried by the workflow: a send bills nothing. */
export const notifyReportStep = async (
  reportId: number
): Promise<ReportNotifyStatus> => {
  "use step";

  if (!emailEnv.RESEND_API_KEY) {
    logger.warn({ reportId }, "RESEND_API_KEY is unset; report not emailed");
    return ReportNotifyStatus.NoEmailKey;
  }

  const db = await connectDatabase(undefined, { withCache: false });
  const report = await getFeedReport(db, reportId);
  if (!report) return ReportNotifyStatus.ReportGone;
  const feed = await getFeedForIndexing(db, { feedId: report.feedId });
  if (!feed) return ReportNotifyStatus.ReportGone;

  const translation =
    feed.translations.find((entry) => entry.locale === report.locale) ??
    feed.translations[0];
  const { sendReportEmail } = await import("@chia/integrations/email/report");
  await sendReportEmail(
    buildReportEmail(report, {
      title: translation?.title ?? feed.slug,
      url: feedUrl({
        type: feed.type,
        slug: feed.slug,
        locale: report.locale,
      }),
    })
  );
  return ReportNotifyStatus.Sent;
};
