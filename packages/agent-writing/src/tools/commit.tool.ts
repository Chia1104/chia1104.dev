import type { Locale } from "@chia/db/types";

import type { WritingTool } from "../types.ts";

import { TOOL_NAMES, labelOf } from "./registry.ts";
import {
  DraftIdSchema,
  Type,
  defineTool,
  jsonBlock,
  textResult,
} from "./schema.ts";

/**
 * The only tools that touch published data. Sequential: applying and publishing in the same
 * batch would race, and the model must see `feedId` before it can publish. No delete or image
 * upload.
 */

export const commitDraftTool = defineTool({
  name: TOOL_NAMES.commitDraft,
  label: labelOf(TOOL_NAMES.commitDraft),
  description:
    "Apply a draft to the database as an UNPUBLISHED post (or update the post the draft is " +
    "already bound to). Requires human approval. This does NOT publish; use `set_published` " +
    "for that.",
  parameters: Type.Object({
    draftId: DraftIdSchema,
    confirmation: Type.String({
      description:
        "One sentence stating what you are committing, shown to the operator in the approval prompt.",
      minLength: 1,
    }),
  }),
  executionMode: "sequential",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    const draft = await context.draft.get(params.draftId);
    // SAFETY: FeedDraft.translations is keyed exclusively by Locale.
    const locales = Object.keys(draft.translations) as Locale[];

    // The apply service rejects these too; checking here gives the model an actionable error
    // before it spends an approval round trip.
    if (locales.length === 0) {
      throw new Error(
        "The draft is empty. Write at least one locale before committing."
      );
    }
    if (!draft.translations[draft.defaultLocale]) {
      throw new Error(
        `No draft for the default locale "${draft.defaultLocale}". Either write it or change defaultLocale via patch_draft_meta.`
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
    if (draft.feedId === null && !draft.slug) {
      throw new Error(
        "A new post needs an English/ASCII slug. Set one with patch_draft_meta before committing."
      );
    }

    const result = await context.content.applyDraft({ draftId: draft.id });

    return textResult(
      `${result.created ? "Created" : "Updated"} feed ${result.feedId} at slug \`${result.slug}\`, ` +
        `still unpublished.\n\n${jsonBlock(result)}`,
      { ...result, draftId: draft.id, confirmation: params.confirmation }
    );
  },
});

export const setPublishedTool = defineTool({
  name: TOOL_NAMES.setPublished,
  label: labelOf(TOOL_NAMES.setPublished),
  description:
    "Publish or unpublish a post. Requires human approval. Publishing makes the post publicly " +
    "visible and triggers reading-time, search-index and embedding jobs. A draft has to be " +
    "committed first; `commit_draft` returns the post's feedId.",
  parameters: Type.Object({
    feedId: Type.Integer({
      description: "The post, as `commit_draft` or `list_posts` reported it.",
    }),
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
    const result = await context.content.setPublished({
      feedId: params.feedId,
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
