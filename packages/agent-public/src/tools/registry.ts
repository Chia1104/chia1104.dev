import {
  CONTENT_TOOL_INFO_BY_NAME,
  CONTENT_TOOL_NAMES,
} from "@chia/agent-content/tools/registry";
import type { AgentToolInfo } from "@chia/agent-runtime/types";

/**
 * Tool identity for the public kind. Kept apart from the tool specs so the policy classifies
 * a call without importing the tools.
 */

/** Named like the writing kind's, so clients show the same activity for both. */
export const WEB_TOOL_NAMES = {
  webSearch: "web_search",
  fetchUrl: "fetch_url",
} as const;

export const WEB_TOOL_INFO_BY_NAME = {
  [WEB_TOOL_NAMES.webSearch]: { label: "Search the web", tier: "read" },
  [WEB_TOOL_NAMES.fetchUrl]: { label: "Read page", tier: "read" },
} as const satisfies Record<string, AgentToolInfo>;

export const TOOL_NAMES = { ...CONTENT_TOOL_NAMES, ...WEB_TOOL_NAMES };

const TOOL_INFO_BY_NAME = {
  ...CONTENT_TOOL_INFO_BY_NAME,
  ...WEB_TOOL_INFO_BY_NAME,
};

const isToolName = (
  toolName: string
): toolName is keyof typeof TOOL_INFO_BY_NAME =>
  Object.hasOwn(TOOL_INFO_BY_NAME, toolName);

/**
 * Unknown names are `read` too: this kind has no tier that changes anything, so there is no
 * more restrictive fallback.
 */
export const toolInfo = (toolName: string): AgentToolInfo =>
  isToolName(toolName)
    ? TOOL_INFO_BY_NAME[toolName]
    : { label: toolName, tier: "read" };
