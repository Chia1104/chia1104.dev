import { formatSkillInvocation } from "@earendil-works/pi-agent-core";
import { StringEnum } from "@earendil-works/pi-ai";

import { writingSkills } from "../prompts/skills.ts";
import type { WritingTool } from "../types.ts";

import { TOOL_NAMES, labelOf } from "./registry.ts";
import { Type, defineTool, textResult } from "./schema.ts";

/**
 * The only path from the skills index in the system prompt to a skill's full text.
 *
 * Pi's own skill convention assumes a file-reading tool, which this agent does not have; without
 * this tool the index advertises rules the model can never load. Going through a tool rather than
 * inlining every skill also leaves a visible record in the thread of which rules were consulted
 * before a body was written.
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
