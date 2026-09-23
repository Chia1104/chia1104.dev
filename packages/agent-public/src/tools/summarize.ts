import { summarizeContentToolResult } from "@chia/agent-content/tools/summarize";
import { toolErrorText, toolResultDetails } from "@chia/agent-runtime/tools";
import { asNumber, asString } from "@chia/utils/json";
import { hostnameOf } from "@chia/utils/url";

import { REPORT_TOOL_NAMES, WEB_TOOL_NAMES } from "./registry.ts";

const summarizeKindToolResult = <TResult>(
  toolName: string,
  result: TResult
): string | undefined => {
  const details = toolResultDetails(result);
  switch (toolName) {
    case WEB_TOOL_NAMES.webSearch: {
      const count = asNumber(details?.count);
      return count === undefined
        ? "Searched the web."
        : `${count} web result(s).`;
    }
    case WEB_TOOL_NAMES.fetchUrl: {
      const url = asString(details?.url);
      return url ? `Read ${hostnameOf(url)}.` : "Read page.";
    }
    case REPORT_TOOL_NAMES.reportIssue:
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
