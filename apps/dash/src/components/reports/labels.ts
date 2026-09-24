import type { RouterOutputs } from "@/libs/orpc/types";

export type ReportView = RouterOutputs["reports"]["get"]["report"];
export type ReportStatus = ReportView["status"];
type Verdict = NonNullable<ReportView["triage"]>["verdict"];

export const STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "dismissed",
] as const satisfies readonly ReportStatus[];

export const STATUS_LABEL = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  dismissed: "Dismissed",
} satisfies Record<ReportStatus, string>;

export const CATEGORY_LABEL = {
  error: "Error",
  outdated: "Outdated",
  typo: "Typo",
  broken: "Broken",
  gap: "Gap",
} satisfies Record<ReportView["category"], string>;

export const VERDICT = {
  likely_valid: { label: "Likely valid", color: "success" },
  needs_verification: { label: "Needs verification", color: "warning" },
  not_valid: { label: "Not valid", color: "default" },
} as const satisfies Record<
  Verdict,
  { label: string; color: "success" | "warning" | "default" }
>;
