import {
  CONTENT_TOOL_INFO_BY_NAME,
  CONTENT_TOOL_NAMES,
} from "@chia/agent-content/tools/registry";
import type { AgentToolInfo } from "@chia/agent-runtime/types";

import type { WritingToolTier } from "../types.ts";

/**
 * Tool identity (name → label, tier and the state a call changes), kept apart from the tool
 * specs so the policy classifies a call without importing the tools.
 */

export const TOOL_NAMES = {
  readSkill: "read_skill",
  ...CONTENT_TOOL_NAMES,
  webSearch: "web_search",
  fetchUrl: "fetch_url",
  githubResolveRef: "github_resolve_ref",
  githubListTree: "github_list_tree",
  githubReadFile: "github_read_file",
  searchMemory: "search_memory",
  getMemory: "get_memory",
  saveMemory: "save_memory",
  proposeLesson: "propose_lesson",
  listDrafts: "list_drafts",
  newDraft: "new_draft",
  openDraft: "open_draft",
  readDraft: "read_draft",
  writeDraft: "write_draft",
  editDraftContent: "edit_draft_content",
  replaceSection: "replace_section",
  commitDraft: "commit_draft",
  setPublished: "set_published",
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

/** The session's drafts, as the session detail carries them. */
const DRAFT_STATE = "draft";

export const TOOL_INFO_BY_NAME = {
  [TOOL_NAMES.readSkill]: { label: "Read skill", tier: "read" },
  ...CONTENT_TOOL_INFO_BY_NAME,
  [TOOL_NAMES.webSearch]: { label: "Search web", tier: "read" },
  [TOOL_NAMES.fetchUrl]: { label: "Fetch page", tier: "read" },
  [TOOL_NAMES.githubResolveRef]: { label: "Resolve GitHub ref", tier: "read" },
  [TOOL_NAMES.githubListTree]: { label: "List GitHub tree", tier: "read" },
  [TOOL_NAMES.githubReadFile]: { label: "Read GitHub file", tier: "read" },
  [TOOL_NAMES.searchMemory]: { label: "Search memory", tier: "read" },
  [TOOL_NAMES.getMemory]: { label: "Read memory", tier: "read" },
  [TOOL_NAMES.listDrafts]: { label: "List drafts", tier: "read" },

  [TOOL_NAMES.saveMemory]: { label: "Save memory", tier: "draft" },
  [TOOL_NAMES.proposeLesson]: { label: "Propose lesson", tier: "draft" },
  [TOOL_NAMES.newDraft]: {
    label: "Start new draft",
    tier: "draft",
    changes: DRAFT_STATE,
  },
  [TOOL_NAMES.openDraft]: {
    label: "Open draft",
    tier: "draft",
    changes: DRAFT_STATE,
  },
  [TOOL_NAMES.readDraft]: { label: "Read draft", tier: "draft" },
  [TOOL_NAMES.writeDraft]: {
    label: "Write draft",
    tier: "draft",
    changes: DRAFT_STATE,
  },
  [TOOL_NAMES.editDraftContent]: {
    label: "Edit draft body",
    tier: "draft",
    changes: DRAFT_STATE,
  },
  [TOOL_NAMES.replaceSection]: {
    label: "Replace draft section",
    tier: "draft",
    changes: DRAFT_STATE,
  },

  [TOOL_NAMES.commitDraft]: {
    label: "Commit draft",
    tier: "commit",
    changes: DRAFT_STATE,
  },
  [TOOL_NAMES.setPublished]: {
    label: "Change published state",
    tier: "commit",
  },
} as const satisfies Record<
  ToolName,
  AgentToolInfo & { tier: WritingToolTier }
>;

const isToolName = (toolName: string): toolName is ToolName =>
  Object.hasOwn(TOOL_INFO_BY_NAME, toolName);

/**
 * Unknown names fall back to the most restrictive tier so an unrecognized tool cannot run
 * unsupervised.
 */
export const toolInfo = (toolName: string): AgentToolInfo =>
  isToolName(toolName)
    ? TOOL_INFO_BY_NAME[toolName]
    : { label: toolName, tier: "commit" };
