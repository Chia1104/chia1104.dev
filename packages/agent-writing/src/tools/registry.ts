import {
  CONTENT_TOOL_LABEL_BY_NAME,
  CONTENT_TOOL_NAMES,
} from "@chia/agent-content/tools/registry";
import type { ToolTier } from "@chia/agent-runtime/types";

/**
 * Tool identity (name → tier/label), kept apart from tool objects so policy can classify a
 * call without constructing tools, which need a port and a database.
 */

export const TOOL_NAMES = {
  readSkill: "read_skill",
  ...CONTENT_TOOL_NAMES,
  webSearch: "web_search",
  fetchUrl: "fetch_url",
  searchMemory: "search_memory",
  getMemory: "get_memory",
  saveMemory: "save_memory",
  readDraft: "read_draft",
  patchDraftMeta: "patch_draft_meta",
  writeDraftContent: "write_draft_content",
  editDraftContent: "edit_draft_content",
  commitDraft: "commit_draft",
  setPublished: "set_published",
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

export const TOOL_TIER_BY_NAME = {
  [TOOL_NAMES.readSkill]: "read",
  [TOOL_NAMES.searchPosts]: "read",
  [TOOL_NAMES.getPost]: "read",
  [TOOL_NAMES.listPosts]: "read",
  [TOOL_NAMES.listTags]: "read",
  [TOOL_NAMES.webSearch]: "read",
  [TOOL_NAMES.fetchUrl]: "read",
  [TOOL_NAMES.searchMemory]: "read",
  [TOOL_NAMES.getMemory]: "read",

  [TOOL_NAMES.saveMemory]: "draft",
  [TOOL_NAMES.readDraft]: "draft",
  [TOOL_NAMES.patchDraftMeta]: "draft",
  [TOOL_NAMES.writeDraftContent]: "draft",
  [TOOL_NAMES.editDraftContent]: "draft",

  [TOOL_NAMES.commitDraft]: "commit",
  [TOOL_NAMES.setPublished]: "commit",
} satisfies Record<ToolName, ToolTier>;

export const TOOL_LABEL_BY_NAME = {
  [TOOL_NAMES.readSkill]: "Read skill",
  ...CONTENT_TOOL_LABEL_BY_NAME,
  [TOOL_NAMES.webSearch]: "Search web",
  [TOOL_NAMES.fetchUrl]: "Fetch page",
  [TOOL_NAMES.searchMemory]: "Search memory",
  [TOOL_NAMES.getMemory]: "Read memory",

  [TOOL_NAMES.saveMemory]: "Save memory",
  [TOOL_NAMES.readDraft]: "Read draft",
  [TOOL_NAMES.patchDraftMeta]: "Update draft metadata",
  [TOOL_NAMES.writeDraftContent]: "Write draft body",
  [TOOL_NAMES.editDraftContent]: "Edit draft body",

  [TOOL_NAMES.commitDraft]: "Commit draft",
  [TOOL_NAMES.setPublished]: "Change published state",
} satisfies Record<ToolName, string>;

export const isToolName = (toolName: string): toolName is ToolName =>
  Object.hasOwn(TOOL_TIER_BY_NAME, toolName);

export const labelOf = (toolName: string): string =>
  isToolName(toolName) ? TOOL_LABEL_BY_NAME[toolName] : toolName;

export const tierOf = (toolName: string): ToolTier =>
  isToolName(toolName) ? TOOL_TIER_BY_NAME[toolName] : "commit";
