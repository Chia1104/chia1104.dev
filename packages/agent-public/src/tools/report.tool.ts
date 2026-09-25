import * as z from "zod";

import { defineTool } from "@chia/agent-runtime/tools";
import type { AgentTool, ToolSpec } from "@chia/agent-runtime/tools";
import { FeedReportCategory } from "@chia/db/schema";
import { Locale } from "@chia/db/types";

import type { ReportPort } from "../ports.ts";

import { ReportToolName } from "./registry.ts";

export const reportIssueSpec = {
  name: ReportToolName.ReportIssue,
  description:
    "Send the author a correction to a published post. Call it after you checked the post " +
    "with `get_post` and the visitor agreed to send what you described, or asked you to " +
    "send it. One report per turn. The author reviews every report; nothing on the site " +
    "changes by itself.",
  parameters: z.object({
    slug: z
      .string()
      .min(1)
      .describe("The post's slug, as a tool or the attachment gave it."),
    locale: z
      .enum(Locale)
      .describe("The locale of the text the report is about."),
    headingPath: z
      .string()
      .max(300)
      .describe(
        'Heading trail of the section, as `get_post` or the attachment names it, e.g. "Setup > Install".'
      )
      .optional(),
    quote: z
      .string()
      .max(1000)
      .describe("The passage the report is about, copied from the post.")
      .optional(),
    category: z
      .enum(FeedReportCategory)
      .describe(
        "error: the post gets something wrong; outdated: it was right and no longer is; " +
          "typo; broken: a link, image or code sample does not work; gap: it leaves out " +
          "something it should cover."
      ),
    claim: z
      .string()
      .min(1)
      .max(2000)
      .describe(
        "What the visitor says is wrong or missing, restated faithfully, without adding to it."
      ),
    assessment: z
      .string()
      .min(1)
      .max(2000)
      .describe(
        "What you found when you checked the post, and the web if you searched: whether the " +
          "claim holds and why. Say so when you could not tell."
      ),
    suggestion: z
      .string()
      .max(2000)
      .describe(
        "How the passage should read instead, or what the fix is, when you or the visitor " +
          "can say. Leave it out when you only know something is wrong."
      )
      .optional(),
  }),
} satisfies ToolSpec;

export const publicReportToolSpecs = [reportIssueSpec] as const;

interface ReportToolContext {
  report: ReportPort;
  state: { sent: boolean };
}

export const reportIssueTool = defineTool(
  reportIssueSpec,
  (context: ReportToolContext) =>
    async (params, { signal }) => {
      if (context.state.sent) {
        throw new Error(
          "This turn already sent a report. Tell the visitor it was sent."
        );
      }
      const { id } = await context.report.submit(params, signal);
      context.state.sent = true;
      return {
        text:
          `Sent report #${id} to the author. Tell the visitor it was sent and that the author ` +
          "reviews every report; do not promise a change or a reply.",
        details: { id, slug: params.slug },
      };
    }
);

/** One state per call, so the one-report limit belongs to one turn. */
export const createPublicReportTools = (report: ReportPort): AgentTool[] => [
  reportIssueTool({ report, state: { sent: false } }),
];
