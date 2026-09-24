import {
  CONTENT_TOOL_INFO_BY_NAME,
  ContentToolName,
} from "@chia/agent-content/tools/registry";
import type { AgentToolInfo } from "@chia/agent-runtime/types";

import { WritingToolTier } from "../types.ts";

/**
 * Tool identity (name → label, tier and the state a call changes), kept apart from the tool
 * specs so the policy classifies a call without importing the tools.
 */

export const ToolName = {
  ReadSkill: "read_skill",
  ...ContentToolName,
  WebSearch: "web_search",
  FetchUrl: "fetch_url",
  GitHubResolveRef: "github_resolve_ref",
  GitHubListTree: "github_list_tree",
  GitHubReadFile: "github_read_file",
  SearchMemory: "search_memory",
  GetMemory: "get_memory",
  SaveMemory: "save_memory",
  ProposeLesson: "propose_lesson",
  ListDrafts: "list_drafts",
  NewDraft: "new_draft",
  OpenDraft: "open_draft",
  ReadDraft: "read_draft",
  WriteDraft: "write_draft",
  EditDraftContent: "edit_draft_content",
  ReplaceSection: "replace_section",
  CommitDraft: "commit_draft",
  SetPublished: "set_published",
} as const;

export type ToolName = (typeof ToolName)[keyof typeof ToolName];

/** The session's drafts, as the session detail carries them. */
const DRAFT_STATE = "draft";

export const TOOL_INFO_BY_NAME = {
  [ToolName.ReadSkill]: { label: "Read skill", tier: WritingToolTier.Read },
  ...CONTENT_TOOL_INFO_BY_NAME,
  [ToolName.WebSearch]: { label: "Search web", tier: WritingToolTier.Read },
  [ToolName.FetchUrl]: { label: "Fetch page", tier: WritingToolTier.Read },
  [ToolName.GitHubResolveRef]: {
    label: "Resolve GitHub ref",
    tier: WritingToolTier.Read,
  },
  [ToolName.GitHubListTree]: {
    label: "List GitHub tree",
    tier: WritingToolTier.Read,
  },
  [ToolName.GitHubReadFile]: {
    label: "Read GitHub file",
    tier: WritingToolTier.Read,
  },
  [ToolName.SearchMemory]: {
    label: "Search memory",
    tier: WritingToolTier.Read,
  },
  [ToolName.GetMemory]: { label: "Read memory", tier: WritingToolTier.Read },
  [ToolName.ListDrafts]: { label: "List drafts", tier: WritingToolTier.Read },

  [ToolName.SaveMemory]: { label: "Save memory", tier: WritingToolTier.Draft },
  [ToolName.ProposeLesson]: {
    label: "Propose lesson",
    tier: WritingToolTier.Draft,
  },
  [ToolName.NewDraft]: {
    label: "Start new draft",
    tier: WritingToolTier.Draft,
    changes: DRAFT_STATE,
  },
  [ToolName.OpenDraft]: {
    label: "Open draft",
    tier: WritingToolTier.Draft,
    changes: DRAFT_STATE,
  },
  [ToolName.ReadDraft]: { label: "Read draft", tier: WritingToolTier.Draft },
  [ToolName.WriteDraft]: {
    label: "Write draft",
    tier: WritingToolTier.Draft,
    changes: DRAFT_STATE,
  },
  [ToolName.EditDraftContent]: {
    label: "Edit draft body",
    tier: WritingToolTier.Draft,
    changes: DRAFT_STATE,
  },
  [ToolName.ReplaceSection]: {
    label: "Replace draft section",
    tier: WritingToolTier.Draft,
    changes: DRAFT_STATE,
  },

  [ToolName.CommitDraft]: {
    label: "Commit draft",
    tier: WritingToolTier.Commit,
    changes: DRAFT_STATE,
  },
  [ToolName.SetPublished]: {
    label: "Change published state",
    tier: WritingToolTier.Commit,
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
    : { label: toolName, tier: WritingToolTier.Commit };
