import { summarizeContentToolResult } from "@chia/agent-content/tools/summarize";
import { toolErrorText, toolResultDetails } from "@chia/agent-runtime/tools";
import { asNumber, asString } from "@chia/utils/json";
import { hostnameOf } from "@chia/utils/url";

import { ReportToolName, WebToolName } from "./registry.ts";

const summarizeKindToolResult = <TResult>(
  toolName: string,
  result: TResult
): string | undefined => {
  const details = toolResultDetails(result);
  switch (toolName) {
    case WebToolName.WebSearch: {
      const count = asNumber(details?.count);
      return count === undefined
        ? "Searched the web."
        : `${count} web result(s).`;
    }
    case WebToolName.FetchUrl: {
      const url = asString(details?.url);
      return url ? `Read ${hostnameOf(url)}.` : "Read page.";
    }
    case ReportToolName.ReportIssue:
      return "Sent to the author.";
    default:
      return undefined;
  }
};

/** One transcript line per tool result; the content tools bring their own wording. */
export const summarizeToolResult = <TResult>(
  toolName: string,
  result: TResult,
  isError: boolean
): string => {
  if (isError) return toolErrorText(result) ?? "Failed.";
  return (
    summarizeContentToolResult(toolName, result) ??
    summarizeKindToolResult(toolName, result) ??
    "Done."
  );
};
