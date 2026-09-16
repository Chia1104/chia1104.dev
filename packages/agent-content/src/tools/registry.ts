import type { AgentToolInfo } from "@chia/agent-runtime/types";

/**
 * Content-read tool identity. Kept apart from the tool specs so a kind's policy can classify a
 * call without importing the tools. Every content tool is a `read` in any kind.
 */

export const CONTENT_TOOL_NAMES = {
  searchPosts: "search_posts",
  getPost: "get_post",
  listPosts: "list_posts",
  listTags: "list_tags",
} as const;

export type ContentToolName =
  (typeof CONTENT_TOOL_NAMES)[keyof typeof CONTENT_TOOL_NAMES];

export const CONTENT_TOOL_INFO_BY_NAME = {
  [CONTENT_TOOL_NAMES.searchPosts]: { label: "Search posts", tier: "read" },
  [CONTENT_TOOL_NAMES.getPost]: { label: "Read post", tier: "read" },
  [CONTENT_TOOL_NAMES.listPosts]: { label: "List posts", tier: "read" },
  [CONTENT_TOOL_NAMES.listTags]: { label: "List tags", tier: "read" },
} as const satisfies Record<ContentToolName, AgentToolInfo>;
