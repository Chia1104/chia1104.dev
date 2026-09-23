import type { AgentTool } from "@earendil-works/pi-agent-core";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

import { defineTool, optional, textResult } from "@chia/agent-runtime/tools";
import type { ToolSpec } from "@chia/agent-runtime/tools";
import { FEED_REPORT_CATEGORY } from "@chia/db/schema";
import { Locale } from "@chia/db/types";

import type { ReportPort } from "../ports.ts";

import { REPORT_TOOL_INFO_BY_NAME, REPORT_TOOL_NAMES } from "./registry.ts";

export const reportIssueSpec = {
  name: REPORT_TOOL_NAMES.reportIssue,
  label: REPORT_TOOL_INFO_BY_NAME[REPORT_TOOL_NAMES.reportIssue].label,
  description:
    "Send the author a correction to a published post. Call it only after you checked the " +
    "post with `get_post`, told the visitor what you would send and they agreed. One report " +
    "per turn. The author reviews every report; nothing on the site changes by itself.",
  parameters: Type.Object({
    slug: Type.String({
      description: "The post's slug, as a tool or the attachment gave it.",
      minLength: 1,
    }),
    locale: StringEnum(Object.values(Locale), {
      description: "The locale of the text the report is about.",
    }),
    headingPath: optional(
      Type.String({
        description:
          'Heading trail of the section, as `get_post` or the attachment names it, e.g. "Setup > Install".',
        maxLength: 300,
      })
    ),
    quote: optional(
      Type.String({
        description: "The passage the report is about, copied from the post.",
        maxLength: 1000,
      })
    ),
    category: StringEnum(Object.values(FEED_REPORT_CATEGORY), {
      description:
        "error: the post gets something wrong; outdated: it was right and no longer is; " +
        "typo; broken: a link, image or code sample does not work; gap: it leaves out " +
        "something it should cover.",
    }),
    claim: Type.String({
      description:
        "What the visitor says is wrong or missing, restated faithfully, without adding to it.",
      minLength: 1,
      maxLength: 2000,
    }),
    assessment: Type.String({
      description:
        "What you found when you checked the post, and the web if you searched: whether the " +
        "claim holds and why. Say so when you could not tell.",
      minLength: 1,
      maxLength: 2000,
    }),
  }),
  executionMode: "sequential",
} satisfies ToolSpec;

export const publicReportToolSpecs = [reportIssueSpec] as const;

interface ReportToolContext {
  report: ReportPort;
  state: { sent: boolean };
}

export const reportIssueTool = defineTool(
  reportIssueSpec,
  (context: ReportToolContext) => async (_toolCallId, params, signal) => {
    if (context.state.sent) {
      throw new Error(
        "This turn already sent a report. Tell the visitor it was sent."
      );
    }
    const { id } = await context.report.submit(params, signal);
    context.state.sent = true;
    return textResult(
      `Sent report #${id} to the author. Tell the visitor it was sent and that the author ` +
        "reviews every report; do not promise a change or a reply.",
      { id, slug: params.slug }
    );
  }
);

/** One state per call, so the one-report limit belongs to one turn. */
export const createPublicReportTools = (report: ReportPort): AgentTool[] => [
  reportIssueTool({ report, state: { sent: false } }),
];
