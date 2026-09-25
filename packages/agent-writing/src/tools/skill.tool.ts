import * as z from "zod";

import { xmlBlock } from "@chia/agent-runtime/prompts";
import { defineTool } from "@chia/agent-runtime/tools";
import type { ToolSpec } from "@chia/agent-runtime/tools";

import { writingSkills } from "../prompts/skills.ts";

import { ToolName } from "./registry.ts";

/**
 * The only path from the skills index to a skill's full text: there is no file-reading tool,
 * and going through a tool also records which rules were loaded.
 */
export const readSkillSpec = {
  name: ToolName.ReadSkill,
  description:
    "Load the full instructions of a skill listed in the system prompt. Read the matching skills " +
    "before writing a body or metadata — `mdx-authoring` for any body, the locale's tone skill " +
    "for prose, `seo-metadata` for title/excerpt/description. Cheap and side-effect free.",
  parameters: z.object({
    name: z
      .enum(writingSkills.map((skill) => skill.name))
      .describe("Skill name exactly as listed in the system prompt."),
  }),
} satisfies ToolSpec;

export const readSkillTool = defineTool(readSkillSpec, () => (params) => {
  const skill = writingSkills.find(
    (candidate) => candidate.name === params.name
  );
  if (!skill) {
    throw new Error(
      `Unknown skill "${params.name}". Available: ${writingSkills.map((candidate) => candidate.name).join(", ")}.`
    );
  }
  return Promise.resolve({
    text: xmlBlock("skill", skill.content, { name: skill.name }),
    details: { name: skill.name },
  });
});
