import {
  CONTENT_TOOL_INFO_BY_NAME,
  ContentToolName,
} from "@chia/agent-content/tools/registry";
import type { AgentToolInfo } from "@chia/agent-runtime/types";

/**
 * Tool identity for the public kind. Kept apart from the tool specs so the policy classifies
 * a call without importing the tools.
 */

/** Named like the writing kind's, so clients show the same activity for both. */
export const WebToolName = {
  WebSearch: "web_search",
  FetchUrl: "fetch_url",
} as const;

export type WebToolName = (typeof WebToolName)[keyof typeof WebToolName];

const WEB_TOOL_INFO_BY_NAME = {
  [WebToolName.WebSearch]: { label: "Search the web", tier: "read" },
  [WebToolName.FetchUrl]: { label: "Read page", tier: "read" },
} as const satisfies Record<WebToolName, AgentToolInfo>;

export const ReportToolName = {
  ReportIssue: "report_issue",
} as const;

export type ReportToolName =
  (typeof ReportToolName)[keyof typeof ReportToolName];

/** `report` writes a row the operator reviews; nothing the visitor reads changes. */
const REPORT_TOOL_INFO_BY_NAME = {
  [ReportToolName.ReportIssue]: {
    label: "Report to the author",
    tier: "report",
  },
} as const satisfies Record<ReportToolName, AgentToolInfo>;

export const ToolName = {
  ...ContentToolName,
  ...WebToolName,
  ...ReportToolName,
} as const;

export type ToolName = (typeof ToolName)[keyof typeof ToolName];

const TOOL_INFO_BY_NAME = {
  ...CONTENT_TOOL_INFO_BY_NAME,
  ...WEB_TOOL_INFO_BY_NAME,
  ...REPORT_TOOL_INFO_BY_NAME,
};

const isToolName = (
  toolName: string
): toolName is keyof typeof TOOL_INFO_BY_NAME =>
  Object.hasOwn(TOOL_INFO_BY_NAME, toolName);

/** Unknown names are `read`: no tier of this kind asks for approval, so none is more restrictive. */
export const toolInfo = (toolName: string): AgentToolInfo =>
  isToolName(toolName)
    ? TOOL_INFO_BY_NAME[toolName]
    : { label: toolName, tier: "read" };
