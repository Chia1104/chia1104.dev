import {
  CONTENT_TOOL_INFO_BY_NAME,
  CONTENT_TOOL_NAMES,
} from "@chia/agent-content/tools/registry";
import type { AgentToolInfo } from "@chia/agent-runtime/types";

/**
 * Tool identity for the public kind. Kept apart from the tool specs so the policy classifies
 * a call without importing the tools.
 */

export const TOOL_NAMES = CONTENT_TOOL_NAMES;

const isToolName = (
  toolName: string
): toolName is keyof typeof CONTENT_TOOL_INFO_BY_NAME =>
  Object.hasOwn(CONTENT_TOOL_INFO_BY_NAME, toolName);

/**
 * Unknown names are `read` too: this kind has no tier that changes anything, so there is no
 * more restrictive fallback.
 */
export const toolInfo = (toolName: string): AgentToolInfo =>
  isToolName(toolName)
    ? CONTENT_TOOL_INFO_BY_NAME[toolName]
    : { label: toolName, tier: "read" };
