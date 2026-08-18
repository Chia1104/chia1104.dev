import {
  CONTENT_TOOL_LABEL_BY_NAME,
  CONTENT_TOOL_NAMES,
} from "@chia/agent-content";
import type { ToolTier } from "@chia/agent-runtime";

/**
 * Single source of truth for tool identity: name → tier and name → UI label.
 *
 * Kept in its own module (rather than derived from the tool objects) so `policy.ts` and
 * `summarize.ts` can classify a tool call without constructing the tools — which need ports,
 * which need a database. The shared content read tools bring their own names and labels; this
 * module only assigns them a tier.
 */

export const TOOL_NAMES = {
  // read
  ...CONTENT_TOOL_NAMES,
  fetchUrl: "fetch_url",
  // draft
  readDraft: "read_draft",
  patchDraftMeta: "patch_draft_meta",
  writeDraftContent: "write_draft_content",
  editDraftContent: "edit_draft_content",
  slugify: "slugify",
  // commit
  commitDraft: "commit_draft",
  setPublished: "set_published",
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

export const TOOL_TIER_BY_NAME = {
  [TOOL_NAMES.searchPosts]: "read",
  [TOOL_NAMES.getPost]: "read",
  [TOOL_NAMES.listPosts]: "read",
  [TOOL_NAMES.listTags]: "read",
  [TOOL_NAMES.fetchUrl]: "read",

  [TOOL_NAMES.readDraft]: "draft",
  [TOOL_NAMES.patchDraftMeta]: "draft",
  [TOOL_NAMES.writeDraftContent]: "draft",
  [TOOL_NAMES.editDraftContent]: "draft",
  [TOOL_NAMES.slugify]: "draft",

  [TOOL_NAMES.commitDraft]: "commit",
  [TOOL_NAMES.setPublished]: "commit",
} satisfies Record<ToolName, ToolTier>;

export const TOOL_LABEL_BY_NAME = {
  ...CONTENT_TOOL_LABEL_BY_NAME,
  [TOOL_NAMES.fetchUrl]: "Fetch page",

  [TOOL_NAMES.readDraft]: "Read draft",
  [TOOL_NAMES.patchDraftMeta]: "Update draft metadata",
  [TOOL_NAMES.writeDraftContent]: "Write draft body",
  [TOOL_NAMES.editDraftContent]: "Edit draft body",
  [TOOL_NAMES.slugify]: "Slugify",

  [TOOL_NAMES.commitDraft]: "Commit draft",
  [TOOL_NAMES.setPublished]: "Change published state",
} satisfies Record<ToolName, string>;

export const isToolName = (toolName: string): toolName is ToolName =>
  Object.hasOwn(TOOL_TIER_BY_NAME, toolName);

export const labelOf = (toolName: string): string =>
  isToolName(toolName) ? TOOL_LABEL_BY_NAME[toolName] : toolName;

export const tierOf = (toolName: string): ToolTier =>
  isToolName(toolName) ? TOOL_TIER_BY_NAME[toolName] : "commit";
