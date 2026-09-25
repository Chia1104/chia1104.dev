import { summarizeContentToolResult } from "@chia/agent-content/tools/summarize";
import { asJsonObject, asNumber, asString } from "@chia/utils/json";
import type { JsonValue } from "@chia/utils/json";
import { hostnameOf } from "@chia/utils/url";

import { ReportToolName, WebToolName } from "./registry.ts";

const summarizeKindToolResult = (
  toolName: string,
  value: JsonValue | undefined
): string | undefined => {
  const details = asJsonObject(value);
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

/** One transcript line per successful tool result; the content tools bring their own wording. */
export const summarizeToolResult = (
  toolName: string,
  value: JsonValue | undefined
): string =>
  summarizeContentToolResult(toolName, value) ??
  summarizeKindToolResult(toolName, value) ??
  "Done.";
