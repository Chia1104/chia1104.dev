/**
 * Single source of truth for the content read tools' identity: name → UI label.
 *
 * Kept apart from the tool objects so a kind's policy and event mapping can classify a call
 * without constructing the tools — which need a port, which needs a database.
 */

export const CONTENT_TOOL_NAMES = {
  searchPosts: "search_posts",
  getPost: "get_post",
  listPosts: "list_posts",
  listTags: "list_tags",
} as const;

export type ContentToolName =
  (typeof CONTENT_TOOL_NAMES)[keyof typeof CONTENT_TOOL_NAMES];

export const CONTENT_TOOL_LABEL_BY_NAME: Record<ContentToolName, string> = {
  [CONTENT_TOOL_NAMES.searchPosts]: "Search posts",
  [CONTENT_TOOL_NAMES.getPost]: "Read post",
  [CONTENT_TOOL_NAMES.listPosts]: "List posts",
  [CONTENT_TOOL_NAMES.listTags]: "List tags",
};

export const isContentToolName = (name: string): name is ContentToolName =>
  name in CONTENT_TOOL_LABEL_BY_NAME;
