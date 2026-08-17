/**
 * `@chia/agent-content` — the read-only content tools every agent kind that reads the blog
 * shares: the read port they need, the tools themselves, and their identity and summaries.
 *
 * Kinds compose these into their own tool sets and prompts; visibility (drafts or published
 * only) is decided by whichever `ContentReadPort` the host builds for that kind.
 */

export * from "./types.ts";
export {
  CONTENT_TOOL_LABEL_BY_NAME,
  CONTENT_TOOL_NAMES,
  isContentToolName,
  type ContentToolName,
} from "./tools/registry.ts";
export {
  contentReadTools,
  getPostTool,
  listPostsTool,
  listTagsTool,
  searchPostsTool,
} from "./tools/read.tool.ts";
export { summarizeContentToolResult } from "./tools/summarize.ts";
