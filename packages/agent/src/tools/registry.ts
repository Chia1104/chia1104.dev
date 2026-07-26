import type { ToolTier } from "../types.ts";

/**
 * Single source of truth for tool identity: name → tier and name → UI label.
 *
 * Kept in its own module (rather than derived from the tool objects) so `permissions.ts` and
 * `events.ts` can classify a tool call without constructing the tools — which need ports,
 * which need a database.
 */

export const TOOL_NAMES = {
  // read
  searchPosts: "search_posts",
  getPost: "get_post",
  listPosts: "list_posts",
  listTags: "list_tags",
  fetchUrl: "fetch_url",
  // draft
  readDraft: "read_draft",
  patchDraftMeta: "patch_draft_meta",
  writeDraftContent: "write_draft_content",
  editDraftContent: "edit_draft_content",
  validateDraft: "validate_draft",
  slugify: "slugify",
  // commit
  commitDraft: "commit_draft",
  setPublished: "set_published",
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

export const TOOL_TIER_BY_NAME: Record<string, ToolTier> = {
  [TOOL_NAMES.searchPosts]: "read",
  [TOOL_NAMES.getPost]: "read",
  [TOOL_NAMES.listPosts]: "read",
  [TOOL_NAMES.listTags]: "read",
  [TOOL_NAMES.fetchUrl]: "read",

  [TOOL_NAMES.readDraft]: "draft",
  [TOOL_NAMES.patchDraftMeta]: "draft",
  [TOOL_NAMES.writeDraftContent]: "draft",
  [TOOL_NAMES.editDraftContent]: "draft",
  [TOOL_NAMES.validateDraft]: "draft",
  [TOOL_NAMES.slugify]: "draft",

  [TOOL_NAMES.commitDraft]: "commit",
  [TOOL_NAMES.setPublished]: "commit",
};

export const TOOL_LABEL_BY_NAME: Record<string, string> = {
  [TOOL_NAMES.searchPosts]: "Search posts",
  [TOOL_NAMES.getPost]: "Read post",
  [TOOL_NAMES.listPosts]: "List posts",
  [TOOL_NAMES.listTags]: "List tags",
  [TOOL_NAMES.fetchUrl]: "Fetch page",

  [TOOL_NAMES.readDraft]: "Read draft",
  [TOOL_NAMES.patchDraftMeta]: "Update draft metadata",
  [TOOL_NAMES.writeDraftContent]: "Write draft body",
  [TOOL_NAMES.editDraftContent]: "Edit draft body",
  [TOOL_NAMES.validateDraft]: "Validate draft",
  [TOOL_NAMES.slugify]: "Slugify",

  [TOOL_NAMES.commitDraft]: "Commit draft",
  [TOOL_NAMES.setPublished]: "Change published state",
};

export const labelOf = (toolName: string): string =>
  TOOL_LABEL_BY_NAME[toolName] ?? toolName;
