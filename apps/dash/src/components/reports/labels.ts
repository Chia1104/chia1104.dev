import {
  FeedReportCategory,
  FeedReportStatus,
  FeedReportVerdict,
} from "@chia/db/schema";

import type { RouterOutputs } from "@/libs/orpc/types";

export type ReportView = RouterOutputs["reports"]["get"]["report"];
export type ReportStatus = ReportView["status"];
type Verdict = NonNullable<ReportView["triage"]>["verdict"];

export const STATUSES = Object.values(FeedReportStatus);

export const STATUS_LABEL = {
  [FeedReportStatus.Open]: "Open",
  [FeedReportStatus.InProgress]: "In progress",
  [FeedReportStatus.Resolved]: "Resolved",
  [FeedReportStatus.Dismissed]: "Dismissed",
} satisfies Record<ReportStatus, string>;

export const CATEGORY_LABEL = {
  [FeedReportCategory.Error]: "Error",
  [FeedReportCategory.Outdated]: "Outdated",
  [FeedReportCategory.Typo]: "Typo",
  [FeedReportCategory.Broken]: "Broken",
  [FeedReportCategory.Gap]: "Gap",
} satisfies Record<ReportView["category"], string>;

export const VERDICT = {
  [FeedReportVerdict.LikelyValid]: { label: "Likely valid", color: "success" },
  [FeedReportVerdict.NeedsVerification]: {
    label: "Needs verification",
    color: "warning",
  },
  [FeedReportVerdict.NotValid]: { label: "Not valid", color: "default" },
} as const satisfies Record<
  Verdict,
  { label: string; color: "success" | "warning" | "default" }
>;
