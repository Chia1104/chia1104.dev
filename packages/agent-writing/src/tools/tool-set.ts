import type { WritingTool } from "../types.ts";

import { commitTools } from "./commit.tool.ts";
import { draftTools } from "./draft.tool.ts";
import { memoryTools } from "./memory.tool.ts";
import { retrievalTools } from "./retrieval.tool.ts";
import { skillTools } from "./skill.tool.ts";

/**
 * Full tool set. Order is the order pi lists tools to the model.
 */
export const createWritingTools = (): WritingTool[] => [
  ...skillTools,
  ...retrievalTools,
  ...memoryTools,
  ...draftTools,
  ...commitTools,
];

/**
 * Everything except commit-tier tools, for a session that must not write the blog.
 */
export const readOnlyToolNames = (): string[] =>
  [...skillTools, ...retrievalTools, ...memoryTools, ...draftTools].map(
    (tool) => tool.name
  );
