import type { WritingTool } from "../types.ts";

import { commitTools } from "./commit.tool.ts";
import { draftTools } from "./draft.tool.ts";
import { retrievalTools } from "./retrieval.tool.ts";

/**
 * The writing agent's full tool set.
 *
 * Ordering is intentional — it is the order pi lists tools to the model, which nudges the
 * natural workflow: ground yourself, draft, then commit.
 */
export const createWritingTools = (): WritingTool[] => [
  ...retrievalTools,
  ...draftTools,
  ...commitTools,
];

/**
 * Names of everything except tier 3, for sessions that should be unable to write at all
 * (e.g. a read-only review session).
 */
export const readOnlyToolNames = (): string[] =>
  [...retrievalTools, ...draftTools].map((tool) => tool.name);

export {
  TOOL_NAMES,
  TOOL_TIER_BY_NAME,
  TOOL_LABEL_BY_NAME,
  labelOf,
  type ToolName,
} from "./registry.ts";
export { summarizeToolResult } from "./summarize.ts";
export { retrievalTools } from "./retrieval.tool.ts";
export { draftTools } from "./draft.tool.ts";
export { commitTools } from "./commit.tool.ts";
export { zodToTypebox } from "./schema.ts";
