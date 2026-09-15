import { formatSkillInvocation } from "@earendil-works/pi-agent-core";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

import { bindTool, textResult } from "@chia/agent-runtime/tools";
import type { ToolSpec } from "@chia/agent-runtime/tools";

import { writingSkills } from "../prompts/skills.ts";

import { TOOL_INFO_BY_NAME, TOOL_NAMES } from "./registry.ts";

/**
 * The only path from the skills index to a skill's full text. Pi's file-reading convention
 * has no tool here; going through a tool also records which rules were loaded.
 */
export const readSkillSpec = {
  name: TOOL_NAMES.readSkill,
  label: TOOL_INFO_BY_NAME[TOOL_NAMES.readSkill].label,
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
} satisfies ToolSpec;

export const readSkillTool = (): AgentTool =>
  bindTool(readSkillSpec, (_toolCallId, params) => {
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
  });
