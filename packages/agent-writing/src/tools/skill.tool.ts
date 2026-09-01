import { formatSkillInvocation } from "@earendil-works/pi-agent-core";
import { StringEnum } from "@earendil-works/pi-ai";

import { writingSkills } from "../prompts/skills.ts";
import type { WritingTool } from "../types.ts";

import { TOOL_NAMES, labelOf } from "./registry.ts";
import { Type, defineTool, textResult } from "./schema.ts";

/**
 * The only path from the skills index to a skill's full text. Pi's file-reading convention
 * has no tool here; going through a tool also records which rules were loaded.
 */
export const readSkillTool = defineTool({
  name: TOOL_NAMES.readSkill,
  label: labelOf(TOOL_NAMES.readSkill),
  description:
    "Load the full instructions of a skill listed in the system prompt. Read the matching skills " +
    "before writing a body or metadata — `mdx-authoring` for any body, the locale's tone skill " +
    "for prose, `seo-metadata` for title/excerpt/description/summary. Cheap and side-effect free.",
  parameters: Type.Object({
    name: StringEnum(
      writingSkills.map((skill) => skill.name),
      { description: "Skill name exactly as listed in the system prompt." }
    ),
  }),
  executionMode: "parallel",
  execute(_toolCallId, params) {
    const skill = writingSkills.find(
      (candidate) => candidate.name === params.name
    );
    if (!skill) {
      throw new Error(
        `Unknown skill "${params.name}". Available: ${writingSkills.map((candidate) => candidate.name).join(", ")}.`
      );
    }
    return Promise.resolve(
      textResult(formatSkillInvocation(skill), { name: skill.name })
    );
  },
});

export const skillTools: WritingTool[] = [readSkillTool];
