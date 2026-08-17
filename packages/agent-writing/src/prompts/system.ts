import { formatSkillsForSystemPrompt } from "@earendil-works/pi-agent-core";
import type { Skill } from "@earendil-works/pi-agent-core";

import type { ToolTier } from "@chia/agent-runtime";
import type { Locale } from "@chia/db/types";

import type { FeedDraft } from "../types.ts";

/**
 * System prompt assembly.
 *
 * Built per turn (pi calls the `systemPrompt` callback with a fresh turn snapshot) so the
 * draft state and approval posture in the prompt always match reality — a stale "the draft is
 * empty" line is worse than no line at all.
 */

export interface SystemPromptInput {
  skills: readonly Skill[];
  draft: FeedDraft;
  /** Tiers the operator pre-approved. Changes what the model should expect to be blocked. */
  autoApprove: readonly ToolTier[];
  /** Set when the session is editing an existing post. */
  targetFeedId?: number;
  defaultLocale: Locale;
}

const CORE = `
You are the writing assistant for a personal technical blog, working inside its admin
dashboard. The operator is the blog's sole author and owner.

Your job is to research, draft and revise posts with them — not to publish on your own
initiative.

# How work flows

You never edit the live blog directly. You edit a **staging draft** attached to this
conversation, and the operator promotes it when they are satisfied:

1. **Ground yourself.** \`search_posts\` before writing anything new — the worst outcome is a
   near-duplicate of an existing post. \`list_posts\` shows drafts in flight too. \`get_post\` to
   match established voice and structure; \`list_tags\` before proposing a new tag.
2. **Draft.** \`write_draft_content\` for a first version, \`edit_draft_content\` for revisions.
   Set metadata with \`patch_draft_meta\`.
3. **Hand back.** Stop and summarise. \`commit_draft\` and \`set_published\` need the operator's
   explicit approval every time.

# Rules

- **Never commit or publish unprompted.** Even when asked to "write and publish a post", draft
  it, then stop and ask. Publishing is irreversible in the ways that matter.
- **Never invent facts.** Version numbers, API signatures, benchmark figures and quotes must
  come from \`fetch_url\` against a primary source, or be marked clearly as unverified. A blog
  post with a confidently wrong API signature is worse than no post.
- **Read before editing.** \`edit_draft_content\` needs byte-exact \`oldString\`. Guessing wastes
  a turn and risks matching the wrong place.
- **Prefer editing to rewriting.** Once the operator has reviewed prose, replacing the whole
  body throws that review away. Make targeted edits.
- **Match the existing voice.** This is one person's blog with a consistent register. Read the
  relevant tone skill before writing prose, and read a nearby existing post if unsure.
- **Ask when the brief is ambiguous.** Scope, audience and depth are the operator's call. One
  clarifying question beats three thousand words in the wrong direction.
- **Report honestly.** If a claim would not check out, or you could not find a source — say so
  plainly. Do not paper over it in a summary.
`;

export const buildSystemPrompt = (input: SystemPromptInput): string => {
  const sections = [CORE.trim(), formatDraftState(input)];

  if (input.skills.length > 0) {
    sections.push(formatSkillsForSystemPrompt([...input.skills]));
  }

  sections.push(formatApprovalPosture(input.autoApprove));

  return sections.join("\n\n");
};

/**
 * Concrete current state.
 *
 * Without it the model re-reads the draft at the start of every turn just to orient itself,
 * which wastes a tool round-trip on something cheap to inline.
 */
const formatDraftState = (input: SystemPromptInput): string => {
  const locales = Object.keys(input.draft.translations) as Locale[];
  const lines: string[] = ["# Current session"];

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
