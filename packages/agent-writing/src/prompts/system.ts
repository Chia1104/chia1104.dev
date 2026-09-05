import type { Skill } from "@earendil-works/pi-agent-core";

import type { ToolTier } from "@chia/agent-runtime/types";
import type { Locale } from "@chia/db/types";

import { draftTitle } from "../draft/operations.ts";
import type { DraftChange, FeedDraft, MemorySummary } from "../types.ts";

/**
 * Prompt assembly split by churn: `buildSystemPrompt` is the cached prefix for a session;
 * `buildTurnContext` is volatile turn state, refreshed per provider request and never persisted.
 */

export interface SystemPromptInput {
  skills: readonly Skill[];
  /** Tiers the operator pre-approved. Changes what the model should expect to be blocked. */
  autoApprove: readonly ToolTier[];
  /**
   * Kind-config instructions. Stable prompt, not volatile: they change when the operator
   * edits them.
   */
  instructions?: string;
}

export interface TurnContextDraft {
  draft: FeedDraft;
  /**
   * What the operator edited in the dashboard since the agent last looked. The draft is
   * shared, so the model must re-read before editing anything listed here.
   */
  operatorChanges?: readonly DraftChange[];
}

export interface TurnContextInput {
  /** Drafts this session has worked on, most recently touched first. */
  drafts: readonly TurnContextDraft[];
  /** Every open draft, worked on here or not; `list_drafts` names them. */
  openDraftCount?: number;
  defaultLocale: Locale;
  now: Date;
  /** What this session has already saved, so the model neither repeats itself nor forgets the ids. */
  sessionMemories?: readonly MemorySummary[];
  /**
   * Active lessons, title only. Always on rather than searched: a preference the model has
   * to remember to look up is not a preference it follows.
   */
  lessons?: readonly MemorySummary[];
}

/**
 * A `source` is shown by URL, never title: the title is the fetched page's `<title>`,
 * attacker-controlled text that would otherwise be restated on every provider request.
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

You never edit the live blog directly. You edit **shared drafts** that the operator also
edits in the dashboard editor, and the operator promotes a draft when they are satisfied:

1. **Pick the draft.** Every draft tool takes a \`draftId\`. The operator usually attaches
   the draft to their message, and the session context below lists the drafts this
   conversation has worked on. Otherwise \`list_drafts\` shows what is open and
   \`open_draft\` opens an existing post's draft or starts a new post. Never guess an id,
   and never open a second draft for a post that already has one.
2. **Load the rules.** \`read_skill\` for every skill whose description matches the task —
   \`mdx-authoring\` before any body, the locale's tone skill before any prose, \`seo-metadata\`
   before any title/excerpt/description/summary. The skills index below lists what exists; it
   is not the content.
3. **Ground yourself.** \`search_posts\` before writing anything new — the worst outcome is a
   near-duplicate of an existing post. \`list_posts\` shows drafts in flight too. \`get_post\` to
   match established voice and structure; \`list_tags\` before proposing a new tag.
   \`search_memory\` once before researching: facts verified and pages read in earlier
   sessions are there, and a hit saves a search and a fetch.
4. **Draft.** \`write_draft_content\` for a first version, \`edit_draft_content\` for revisions.
   Set metadata with \`patch_draft_meta\`; its result echoes the merged fields, so trust it
   rather than re-reading.
5. **Hand back.** Stop and summarise. \`commit_draft\` and \`set_published\` need the operator's
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
  a turn and risks matching the wrong place. The operator may have edited a draft since your
  last turn; the session context lists what they touched, per draft.
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

const draftLines = ({ draft, operatorChanges }: TurnContextDraft): string[] => {
  // SAFETY: FeedDraft.translations is keyed exclusively by Locale.
  const locales = Object.keys(draft.translations) as Locale[];
  const title = draftTitle(draft);
  const lines = [
    `  - Draft #${draft.id}${title ? ` "${oneLine(title, MEMORY_TITLE_MAX_CHARS)}"` : ""}: ` +
      `${draft.feedId === null ? "new post, not yet committed" : `feed ${draft.feedId}`}, ` +
      `revision ${draft.revision}, slug ${draft.slug ?? "(not set)"}, type ${draft.type}, ` +
      `default locale ${draft.defaultLocale}`,
  ];
  if (locales.length === 0) {
    lines.push("    - no locales yet — the draft is empty");
  }
  for (const locale of locales) {
    const translation = draft.translations[locale];
    const body = translation?.content ?? "";
    const missing = (
      ["title", "excerpt", "description", "summary"] as const
    ).filter((field) => !translation?.[field]);
    lines.push(
      `    - ${locale}: ${body.length === 0 ? "no body" : `${body.split("\n").length} lines`}` +
        (missing.length > 0
          ? `, missing ${missing.join("/")}`
          : ", metadata complete")
    );
  }
  if (operatorChanges && operatorChanges.length > 0) {
    lines.push(
      "    - Operator edits since your last turn (read again before editing these): " +
        operatorChanges
          .map(
            (change) =>
              `${change.locale ? `${change.locale}: ` : "feed-level: "}${change.fields.join(", ")}`
          )
          .join("; ")
    );
  }
  return lines;
};

/**
 * Inline draft state and clock so the model does not spend a tool round-trip to orient, and
 * has an anchor for "today".
 */
export const buildTurnContext = (input: TurnContextInput): string => {
  const lines: string[] = ["# Current session"];

  lines.push(`- Current time: ${input.now.toISOString()} (UTC)`);
  lines.push(`- Site default locale: ${input.defaultLocale}`);
  if (input.openDraftCount !== undefined) {
    lines.push(
      `- Open drafts: ${input.openDraftCount} (\`list_drafts\` names them)`
    );
  }

  if (input.drafts.length === 0) {
    lines.push(
      "- Drafts this conversation works on: none yet. Use the draft the operator attached, " +
        "`list_drafts` to pick an open one, or `open_draft`."
    );
  } else {
    lines.push("- Drafts this conversation works on, most recent first:");
    for (const entry of input.drafts) lines.push(...draftLines(entry));
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
 * Pi's `formatSkillsForSystemPrompt` tells the model to read a skill file at `filePath`.
 * This agent loads skills through `read_skill`, so the index has to name that path.
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
