import type { FeedReportCategory } from "@chia/db/schema";
import type { Locale } from "@chia/db/types";

export interface ReportIssueInput {
  slug: string;
  locale: Locale;
  headingPath?: string;
  quote?: string;
  category: FeedReportCategory;
  claim: string;
  assessment: string;
}

/**
 * Files a reader's correction for the operator. The host binds it to the session's signed-in
 * owner; it resolves only published posts and throws with a message the model can relay.
 */
export interface ReportPort {
  submit(
    input: ReportIssueInput,
    signal?: AbortSignal
  ): Promise<{ id: number }>;
}
