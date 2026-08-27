import type { Skill } from "@earendil-works/pi-agent-core";

import type { ToolTier } from "@chia/agent-runtime/types";
import type { Locale } from "@chia/db/types";

import type { FeedDraft, MemorySummary } from "../types.ts";

/**
 * Prompt assembly, split by how often the text changes.
 *
 * `buildSystemPrompt` is stable for a session — rules, skills index and approval posture — so the
 * provider's cached prefix (system prompt, tool schemas, transcript) survives from turn to turn.
 * `buildTurnContext` is the volatile block: draft state, the clock and what the session has saved
 * to memory, refreshed on every provider request through Pi's `context` hook and never persisted,
 * so it is always current and never accumulates in the transcript.
 */

export interface SystemPromptInput {
  skills: readonly Skill[];
  /** Tiers the operator pre-approved. Changes what the model should expect to be blocked. */
  autoApprove: readonly ToolTier[];
  /**
   * The operator's standing instructions from the kind's configuration. Part of the stable
   * prompt, not the volatile block: they change when the operator edits them, not per turn,
   * and a change is meant to reach every session from its next turn on.
   */
  instructions?: string;
}

export interface TurnContextInput {
  draft: FeedDraft;
  /** Set when the session is editing an existing post. */
  targetFeedId?: number;
  defaultLocale: Locale;
  now: Date;
  /** What this session has already saved, so the model neither repeats itself nor forgets the ids. */
  sessionMemories?: readonly MemorySummary[];
  /**
   * Active lessons, title only. Always on rather than searched for: a preference the model has
   * to remember to look up is not a preference it follows.
   */
  lessons?: readonly MemorySummary[];
}

/**
 * A memory is one line in the volatile block. A `source` is shown by where it is, never by
 * its title: the title is the fetched page's own `<title>`, attacker-controlled text that
 * would otherwise be restated on every provider request. The URL is structural — validated
 * http(s), fragment stripped — so its host and path identify the page safely.
 */
const MEMORY_TITLE_MAX_CHARS = 120;

const oneLine = (text: string, max: number): string => {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};

const memoryLabel = (memory: MemorySummary): string => {
  if (memory.kind === "source" && memory.sourceUrl) {
    try {
      const url = new URL(memory.sourceUrl);
      return oneLine(`${url.hostname}${url.pathname}`, MEMORY_TITLE_MAX_CHARS);
    } catch {
      return "(page)";
    }
  }
  return oneLine(memory.title, MEMORY_TITLE_MAX_CHARS);
};

const CORE = `
You are the writing assistant for a personal technical blog, working inside its admin
dashboard. The operator is the blog's sole author and owner.

Your job is to research, draft and revise posts with them — not to publish on your own
initiative.

# How work flows

You never edit the live blog directly. You edit a **staging draft** attached to this
conversation, and the operator promotes it when they are satisfied:

1. **Load the rules.** \`read_skill\` for every skill whose description matches the task —
   \`mdx-authoring\` before any body, the locale's tone skill before any prose, \`seo-metadata\`
   before any title/excerpt/description/summary. The skills index below lists what exists; it
   is not the content.
2. **Ground yourself.** \`search_posts\` before writing anything new — the worst outcome is a
   near-duplicate of an existing post. \`list_posts\` shows drafts in flight too. \`get_post\` to
   match established voice and structure; \`list_tags\` before proposing a new tag.
   \`search_memory\` once before researching: facts verified and pages read in earlier
   sessions are there, and a hit saves a search and a fetch.
3. **Draft.** \`write_draft_content\` for a first version, \`edit_draft_content\` for revisions.
   Set metadata with \`patch_draft_meta\`; its result echoes the merged fields, so trust it
   rather than re-reading.
4. **Hand back.** Stop and summarise. \`commit_draft\` and \`set_published\` need the operator's
   explicit approval every time.

# Rules

- **Never commit or publish unprompted.** Even when asked to "write and publish a post", draft
  it, then stop and ask. Publishing is irreversible in the ways that matter.
- **Never invent facts.** Version numbers, API signatures, benchmark figures and quotes must
  come from a primary source — \`web_search\` to find it, \`fetch_url\` to read it — or be
  marked clearly as unverified. A search snippet is not a source. A blog post with a
  confidently wrong API signature is worse than no post.
- **Remember what you verified.** When a source settles a concrete fact — a version number, an
  API signature, a figure — \`save_memory\` it with the URL, so the next session does not
  re-research it. Record the conclusion, not the page.
- **Read before editing.** \`edit_draft_content\` needs byte-exact \`oldString\`. Guessing wastes
  a turn and risks matching the wrong place.
- **Prefer editing to rewriting.** Once the operator has reviewed prose, replacing the whole
  body throws that review away. Make targeted edits.
- **Match the existing voice.** This is one person's blog with a consistent register.
  \`read_skill\` the relevant tone skill before writing prose, and read a nearby existing post
  if unsure.
- **Ask when the brief is ambiguous.** Scope, audience and depth are the operator's call. One
  clarifying question beats three thousand words in the wrong direction.
- **Report honestly.** If a claim would not check out, or you could not find a source — say so
  plainly. Do not paper over it in a summary. The same goes for anything you were told to use
  and could not: if a skill, tool or page would not load, say that you skipped it instead of
  silently substituting something else.
`;

export const buildSystemPrompt = (input: SystemPromptInput): string => {
  const sections = [CORE.trim()];

  if (input.skills.length > 0) {
    sections.push(formatSkillsIndex(input.skills));
  }

  sections.push(formatApprovalPosture(input.autoApprove));

  const instructions = input.instructions?.trim();
  if (instructions) {
    sections.push(`# Operator instructions\n\n${instructions}`);
  }

  return sections.join("\n\n");
};

/**
 * Concrete current state.
 *
 * Without it the model re-reads the draft at the start of every turn just to orient itself,
 * which wastes a tool round-trip on something cheap to inline. The clock is there because the
 * model otherwise has no anchor for "today", "latest" or a publish date.
 */
export const buildTurnContext = (input: TurnContextInput): string => {
  // SAFETY: FeedDraft.translations is keyed exclusively by Locale.
  const locales = Object.keys(input.draft.translations) as Locale[];
  const lines: string[] = ["# Current session"];

  lines.push(`- Current time: ${input.now.toISOString()} (UTC)`);
  lines.push(
    input.targetFeedId === undefined &&
      input.draft.committedFeedId === undefined
      ? "- Editing: a new post, not yet committed to the database."
      : `- Editing: existing feed ${input.draft.committedFeedId ?? input.targetFeedId}.`
  );

  lines.push(`- Site default locale: ${input.defaultLocale}`);
  lines.push(
    `- Draft default locale: ${input.draft.feedMeta.defaultLocale ?? "(not set)"}`
  );
  lines.push(`- Draft slug: ${input.draft.feedMeta.slug ?? "(not set)"}`);
  lines.push(`- Draft type: ${input.draft.feedMeta.type ?? "(not set)"}`);

  if (locales.length === 0) {
    lines.push("- Draft locales: none — the draft is empty.");
  } else {
    lines.push("- Draft locales:");
    for (const locale of locales) {
      const translation = input.draft.translations[locale];
      const body = translation?.content ?? "";
      const missing = (
        ["title", "excerpt", "description", "summary"] as const
      ).filter((field) => !translation?.[field]);
      lines.push(
        `  - ${locale}: ${body.length === 0 ? "no body" : `${body.split("\n").length} lines`}` +
          (missing.length > 0
            ? `, missing ${missing.join("/")}`
            : ", metadata complete")
      );
    }
  }

  if (input.sessionMemories && input.sessionMemories.length > 0) {
    lines.push("- Memories saved this session (read one with `get_memory`):");
    for (const memory of input.sessionMemories) {
      lines.push(`  - [${memory.kind}] ${memoryLabel(memory)} (#${memory.id})`);
    }
  }

  if (input.lessons && input.lessons.length > 0) {
    lines.push("");
    lines.push("# Learned preferences");
    lines.push("");
    lines.push(
      "The operator's standing preferences, distilled from their feedback in earlier sessions" +
        " and reviewed by them. Follow them without being asked; `get_memory` reads the detail."
    );
    for (const lesson of input.lessons) {
      lines.push(
        `- ${oneLine(lesson.title, MEMORY_TITLE_MAX_CHARS)} (#${lesson.id})`
      );
    }
  }

  return lines.join("\n");
};

/**
 * Pi's own `formatSkillsForSystemPrompt` tells the model to read a skill *file* at its
 * `filePath`, which presumes a file-reading tool. This agent loads skills through `read_skill`
 * instead, so the index has to name that path or the model is left guessing at URLs.
 */
const formatSkillsIndex = (skills: readonly Skill[]): string => {
  const lines = [
    "# Skills",
    "",
    "Skills hold the detailed rules for specific parts of the job. This index is only names and",
    "descriptions — call `read_skill` with the name to load the full instructions whenever a task",
    "matches a description. Do not act on a skill you have not loaded in this session.",
    "",
    "<available_skills>",
  ];
  for (const skill of skills) {
    if (skill.disableModelInvocation) continue;
    lines.push("  <skill>");
    lines.push(`    <name>${skill.name}</name>`);
    lines.push(`    <description>${skill.description}</description>`);
    lines.push("  </skill>");
  }
  lines.push("</available_skills>");
  return lines.join("\n");
};

const formatApprovalPosture = (autoApprove: readonly ToolTier[]): string => {
  if (autoApprove.includes("commit")) {
    return [
      "# Approval",
      "",
      "The operator has pre-approved database writes for this session, so `commit_draft` and",
      "`set_published` will execute without prompting. That removes the safety net — state what",
      "you are about to do before you do it, and still never publish without being asked.",
    ].join("\n");
  }

  return [
    "# Approval",
    "",
    "`commit_draft` and `set_published` are gated. Calling one sends an approval request to the",
    "operator and returns an error to you — that error is expected, not a failure you should work",
    "around. When it happens, stop, summarise what is staged, and wait. Do not retry the tool and",
    "do not look for another route to the database.",
  ].join("\n");
};
