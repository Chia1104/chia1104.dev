import type { AgentTool } from "@earendil-works/pi-agent-core";

import { contentReadTools } from "@chia/agent-content/tools/read";
import type { ToolFactory, ToolSpec } from "@chia/agent-runtime/tools";

import type { WritingToolContext } from "../types.ts";

import { commitDraftTool, setPublishedTool } from "./commit.tool.ts";
import {
  editDraftContentTool,
  listDraftsTool,
  newDraftTool,
  openDraftTool,
  readDraftTool,
  replaceSectionTool,
  writeDraftTool,
} from "./draft.tool.ts";
import {
  githubListTreeTool,
  githubReadFileTool,
  githubResolveRefTool,
} from "./github.tool.ts";
import {
  getMemoryTool,
  proposeLessonTool,
  saveMemoryTool,
  searchMemoryTool,
} from "./memory.tool.ts";
import { fetchUrlTool, webSearchTool } from "./retrieval.tool.ts";
import { readSkillTool } from "./skill.tool.ts";

/** Full tool set. Order is the order pi lists tools to the model. */
const writingTools: readonly ToolFactory<WritingToolContext>[] = [
  readSkillTool,
  ...contentReadTools,
  webSearchTool,
  fetchUrlTool,
  githubResolveRefTool,
  githubListTreeTool,
  githubReadFileTool,
  searchMemoryTool,
  getMemoryTool,
  saveMemoryTool,
  proposeLessonTool,
  listDraftsTool,
  newDraftTool,
  openDraftTool,
  readDraftTool,
  writeDraftTool,
  editDraftContentTool,
  replaceSectionTool,
  commitDraftTool,
  setPublishedTool,
];

export const writingToolSpecs: ToolSpec[] = writingTools.map(
  (tool) => tool.spec
);

export const createWritingTools = (context: WritingToolContext): AgentTool[] =>
  writingTools.map((tool) => tool(context));
