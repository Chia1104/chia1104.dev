import type { AgentToolInfo } from "@chia/agent-runtime/types";

/**
 * Content-read tool identity. Kept apart from the tool specs so a kind's policy can classify a
 * call without importing the tools. Every content tool is a `read` in any kind.
 */

export const ContentToolName = {
  SearchPosts: "search_posts",
  GetPost: "get_post",
  ListPosts: "list_posts",
  ListTags: "list_tags",
} as const;

export type ContentToolName =
  (typeof ContentToolName)[keyof typeof ContentToolName];

export const CONTENT_TOOL_INFO_BY_NAME = {
  [ContentToolName.SearchPosts]: { label: "Search posts", tier: "read" },
  [ContentToolName.GetPost]: { label: "Read post", tier: "read" },
  [ContentToolName.ListPosts]: { label: "List posts", tier: "read" },
  [ContentToolName.ListTags]: { label: "List tags", tier: "read" },
} as const satisfies Record<ContentToolName, AgentToolInfo>;
