import {
  CONTENT_TOOL_LABEL_BY_NAME,
  CONTENT_TOOL_NAMES,
} from "@chia/agent-content/tools/registry";
import type { ContentToolName } from "@chia/agent-content/tools/registry";
import type { ToolTier } from "@chia/agent-runtime/types";

import type { PublicToolTier } from "../types.ts";

/**
 * Tool identity for the public kind: the shared content read tools, every one of them `read`.
 * Kept apart from the tool objects so the policy classifies a call without constructing the
 * tools, which need a port, which needs a database.
 */

export const TOOL_NAMES = CONTENT_TOOL_NAMES;

export type ToolName = ContentToolName;

export const TOOL_TIER_BY_NAME = {
  [TOOL_NAMES.searchPosts]: "read",
  [TOOL_NAMES.getPost]: "read",
  [TOOL_NAMES.listPosts]: "read",
  [TOOL_NAMES.listTags]: "read",
} satisfies Record<ToolName, PublicToolTier>;

export const TOOL_LABEL_BY_NAME = CONTENT_TOOL_LABEL_BY_NAME;

export const isToolName = (toolName: string): toolName is ToolName =>
  Object.hasOwn(TOOL_TIER_BY_NAME, toolName);

export const labelOf = (toolName: string): string =>
  isToolName(toolName) ? TOOL_LABEL_BY_NAME[toolName] : toolName;

/**
 * Unknown names are `read` too: this kind has no tier that changes anything, so there is no
 * more restrictive tier to fall back to, and a tool the kind does not recognise cannot be in
 * its tool set in the first place.
 */
export const tierOf = (toolName: string): ToolTier =>
  isToolName(toolName) ? TOOL_TIER_BY_NAME[toolName] : "read";
