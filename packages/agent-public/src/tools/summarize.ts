import { summarizeContentToolResult } from "@chia/agent-content/tools/summarize";
import { toolErrorText } from "@chia/agent-runtime/tools";

/** One transcript line per tool result; the content tools bring their own wording. */
export const summarizeToolResult = <TResult>(
  toolName: string,
  result: TResult,
  isError: boolean
): string => {
  if (isError) return toolErrorText(result) ?? "Failed.";
  return summarizeContentToolResult(toolName, result) ?? "Done.";
};
