import type { Locale } from "@chia/db/types";

import type { WritingTool } from "../types.ts";

import { TOOL_NAMES, labelOf } from "./registry.ts";
import { Type, defineTool, jsonBlock, textResult } from "./schema.ts";

/**
 * Tier 3 — the only tools that touch published data.
 *
 * Both are gated by `permissions.ts`. They are also `sequential`: committing and publishing in
 * the same batch would race, and the model must see the resulting `feedId` before it can
 * publish.
 *
 * Deliberately absent: delete, hard-delete and image upload. The agent has no business
 * removing posts, and presigned uploads stay a human action.
 */

export const commitDraftTool = defineTool({
  name: TOOL_NAMES.commitDraft,
  label: labelOf(TOOL_NAMES.commitDraft),
  description:
    "Write the staged draft to the database as an UNPUBLISHED post (or update the post this " +
    "session is already bound to). Requires human approval. Run `validate_draft` for every locale " +
    "first — committing MDX that does not compile breaks the page. This does NOT publish; use " +
    "`set_published` for that.",
  parameters: Type.Object({
    confirmation: Type.String({
      description:
        "One sentence stating what you are committing, shown to the operator in the approval prompt.",
      minLength: 1,
    }),
  }),
  executionMode: "sequential",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    const draft = await context.draft.get(context.agentSessionId);
    const locales = Object.keys(draft.translations) as Locale[];

    if (locales.length === 0) {
      throw new Error(
        "The draft is empty. Write at least one locale before committing."
      );
    }

    // The create procedure requires a translation for the default locale and rejects a
    // translation without a title — check here so the model gets an actionable error instead of
    // a BAD_REQUEST from the RPC layer.
    const defaultLocale = draft.feedMeta.defaultLocale ?? locales[0]!;
    if (!draft.translations[defaultLocale]) {
      throw new Error(
        `No draft for the default locale "${defaultLocale}". Either write it or change defaultLocale via patch_draft_meta.`
      );
    }
    const untitled = locales.filter(
      (locale) => !draft.translations[locale]?.title?.trim()
    );
    if (untitled.length > 0) {
      throw new Error(
        `These locales have no title: ${untitled.join(", ")}. Every translation needs one.`
      );
    }

    const result = await context.content.commitDraft({
      adminId: context.adminId,
      feedId: draft.committedFeedId ?? context.targetFeedId,
      feedMeta: { ...draft.feedMeta, defaultLocale },
      translations: draft.translations,
    });

    await context.draft.markCommitted(context.agentSessionId, result.feedId);

    const droppedTags = draft.feedMeta.tagSlugs ?? [];

    return textResult(
      `${result.created ? "Created" : "Updated"} feed ${result.feedId} at slug \`${result.slug}\`, ` +
        `still unpublished.\n\n${jsonBlock(result)}` +
        (droppedTags.length > 0
          ? `\n\nNote: the suggested tags (${droppedTags.join(", ")}) were NOT attached — ` +
            `there is no tag write API yet. Mention them to the operator so they can add them by hand.`
          : ""),
      { ...result, confirmation: params.confirmation, droppedTags }
    );
  },
});

export const setPublishedTool = defineTool({
  name: TOOL_NAMES.setPublished,
  label: labelOf(TOOL_NAMES.setPublished),
  description:
    "Publish or unpublish a committed post. Requires human approval. Publishing makes the post " +
    "publicly visible and triggers reading-time, search-index and embedding jobs. Commit first.",
  parameters: Type.Object({
    published: Type.Boolean({
      description: "`true` to publish, `false` to withdraw.",
    }),
    confirmation: Type.String({
      description:
        "One sentence stating which post and why, shown to the operator in the approval prompt.",
      minLength: 1,
    }),
  }),
  executionMode: "sequential",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    const draft = await context.draft.get(context.agentSessionId);
    const feedId = draft.committedFeedId ?? context.targetFeedId;

    if (feedId === undefined) {
      throw new Error(
        "This session has no committed post yet. Run commit_draft first."
      );
    }

    const result = await context.content.setPublished({
      adminId: context.adminId,
      feedId,
      published: params.published,
    });

    return textResult(
      `Feed ${result.feedId} is now ${result.published ? "published" : "unpublished"}.` +
        (result.published
          ? " Indexing (reading time, search, embeddings) runs in the background."
          : ""),
      { ...result, confirmation: params.confirmation }
    );
  },
});

export const commitTools: WritingTool[] = [commitDraftTool, setPublishedTool];
