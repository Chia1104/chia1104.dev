import type { AgentTool } from "@earendil-works/pi-agent-core";

import {
  contentReadToolSpecs,
  createContentReadTools,
} from "@chia/agent-content/tools/read";
import type { ToolSpec } from "@chia/agent-runtime/tools";

import type { WritingToolContext } from "../types.ts";

import {
  commitDraftSpec,
  commitDraftTool,
  setPublishedSpec,
  setPublishedTool,
} from "./commit.tool.ts";
import {
  editDraftContentSpec,
  editDraftContentTool,
  listDraftsSpec,
  listDraftsTool,
  newDraftSpec,
  newDraftTool,
  openDraftSpec,
  openDraftTool,
  readDraftSpec,
  readDraftTool,
  replaceSectionSpec,
  replaceSectionTool,
  writeDraftSpec,
  writeDraftTool,
} from "./draft.tool.ts";
import {
  githubListTreeSpec,
  githubListTreeTool,
  githubReadFileSpec,
  githubReadFileTool,
  githubResolveRefSpec,
  githubResolveRefTool,
} from "./github.tool.ts";
import {
  getMemorySpec,
  getMemoryTool,
  proposeLessonSpec,
  proposeLessonTool,
  saveMemorySpec,
  saveMemoryTool,
  searchMemorySpec,
  searchMemoryTool,
} from "./memory.tool.ts";
import {
  fetchUrlSpec,
  fetchUrlTool,
  webSearchSpec,
  webSearchTool,
} from "./retrieval.tool.ts";
import { readSkillSpec, readSkillTool } from "./skill.tool.ts";

/** In the order {@link createWritingTools} builds them. */
export const writingToolSpecs: ToolSpec[] = [
  readSkillSpec,
  ...contentReadToolSpecs,
  webSearchSpec,
  fetchUrlSpec,
  githubResolveRefSpec,
  githubListTreeSpec,
  githubReadFileSpec,
  searchMemorySpec,
  getMemorySpec,
  saveMemorySpec,
  proposeLessonSpec,
  listDraftsSpec,
  newDraftSpec,
  openDraftSpec,
  readDraftSpec,
  writeDraftSpec,
  editDraftContentSpec,
  replaceSectionSpec,
  commitDraftSpec,
  setPublishedSpec,
];

/** Full tool set. Order is the order pi lists tools to the model. */
export const createWritingTools = (
  context: WritingToolContext
): AgentTool[] => [
  readSkillTool(),
  ...createContentReadTools(context),
  webSearchTool(context),
  fetchUrlTool(context),
  githubResolveRefTool(context),
  githubListTreeTool(context),
  githubReadFileTool(context),
  searchMemoryTool(context),
  getMemoryTool(context),
  saveMemoryTool(context),
  proposeLessonTool(context),
  listDraftsTool(context),
  newDraftTool(context),
  openDraftTool(context),
  readDraftTool(context),
  writeDraftTool(context),
  editDraftContentTool(context),
  replaceSectionTool(context),
  commitDraftTool(context),
  setPublishedTool(context),
];
