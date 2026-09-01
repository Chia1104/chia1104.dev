/**
 * Content-read tool identity (name → UI label). Kept apart from the tool objects so a kind's
 * policy can classify a call without constructing tools, which need a port and a database.
 */

export const CONTENT_TOOL_NAMES = {
  searchPosts: "search_posts",
  getPost: "get_post",
  listPosts: "list_posts",
  listTags: "list_tags",
} as const;

export type ContentToolName =
  (typeof CONTENT_TOOL_NAMES)[keyof typeof CONTENT_TOOL_NAMES];

export const CONTENT_TOOL_LABEL_BY_NAME = {
  [CONTENT_TOOL_NAMES.searchPosts]: "Search posts",
  [CONTENT_TOOL_NAMES.getPost]: "Read post",
  [CONTENT_TOOL_NAMES.listPosts]: "List posts",
  [CONTENT_TOOL_NAMES.listTags]: "List tags",
} satisfies Record<ContentToolName, string>;

export const isContentToolName = (name: string): name is ContentToolName =>
  Object.prototype.hasOwnProperty.call(CONTENT_TOOL_LABEL_BY_NAME, name);
