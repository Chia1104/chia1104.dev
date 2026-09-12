import * as z from "zod";

import type {
  ToolCallRefusal,
  ToolCallRequest,
} from "@chia/agent-runtime/types";
import type { Locale } from "@chia/db/types";

import { DraftNotFoundError, languageMismatch } from "../draft/operations.ts";
import type { FeedDraft, WritingTool, WritingToolContext } from "../types.ts";

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

/** Why a draft cannot be applied yet; the apply service rejects the same cases. */
const commitBlocker = (draft: FeedDraft): string | undefined => {
  // SAFETY: FeedDraft.translations is keyed exclusively by Locale.
  const locales = Object.keys(draft.translations) as Locale[];
  if (locales.length === 0) {
    return "The draft is empty. Write at least one locale before committing.";
  }
  if (!draft.translations[draft.defaultLocale]) {
    return `No draft for the default locale "${draft.defaultLocale}". Either write it or change defaultLocale with write_draft.`;
  }
  const untitled = locales.filter(
    (locale) => !draft.translations[locale]?.title?.trim()
  );
  if (untitled.length > 0) {
    return `These locales have no title: ${untitled.join(", ")}. Every translation needs one.`;
  }
  for (const locale of locales) {
    const mismatch = languageMismatch(
      locale,
      draft.translations[locale]?.content ?? ""
    );
    if (mismatch) return mismatch;
  }
  if (draft.feedId === null && !draft.slug) {
    return "A new post needs an English/ASCII slug. Set one with write_draft before committing.";
  }
  return undefined;
};

const METADATA_FIELDS = ["excerpt", "description", "summary"] as const;

/** Per locale, the optional metadata still empty, as `"en: excerpt, summary"`. */
const metadataGapsOf = (draft: FeedDraft): string[] =>
  // SAFETY: FeedDraft.translations is keyed exclusively by Locale.
  (Object.keys(draft.translations) as Locale[]).flatMap((locale) => {
    const translation = draft.translations[locale];
    const missing = METADATA_FIELDS.filter((field) => !translation?.[field]);
    return missing.length > 0 ? [`${locale}: ${missing.join(", ")}`] : [];
  });

const commitArgsSchema = z.object({
  draftId: z.number().int(),
  allowEmptyMetadata: z.boolean().optional(),
});

/**
 * Runs before the approval gate, so a commit that would fail or silently ship empty metadata
 * is refused without spending the operator's approval. The refusal reads like a tool error.
 */
export const commitPreflight =
  (context: WritingToolContext) =>
  async (request: ToolCallRequest): Promise<ToolCallRefusal | undefined> => {
    if (request.toolName !== TOOL_NAMES.commitDraft) return undefined;
    const args = commitArgsSchema.safeParse(request.input);
    if (!args.success) return undefined;

    let draft: FeedDraft;
    try {
      draft = await context.draft.get(args.data.draftId);
    } catch (error) {
      if (error instanceof DraftNotFoundError) {
        return { block: true, reason: error.message };
      }
      throw error;
    }

    const blocker = commitBlocker(draft);
    if (blocker) return { block: true, reason: blocker };

    const gaps = metadataGapsOf(draft);
    if (gaps.length > 0 && !args.data.allowEmptyMetadata) {
      return {
        block: true,
        reason:
          `Metadata still empty — ${gaps.join("; ")}. Fill it with write_draft, or pass ` +
          "`allowEmptyMetadata: true` and name the empty fields in `confirmation` so the " +
          "operator approves knowingly.",
      };
    }
    return undefined;
  };

export const commitDraftTool = defineTool({
  name: TOOL_NAMES.commitDraft,
  label: labelOf(TOOL_NAMES.commitDraft),
  description:
    "Apply a draft to the database as an UNPUBLISHED post (or update the post the draft is " +
    "already bound to). Requires human approval. This does NOT publish; use `set_published` " +
    "for that. Refused before approval while excerpt, description or summary is empty for any " +
    "locale, unless `allowEmptyMetadata` is set.",
  parameters: Type.Object({
    draftId: DraftIdSchema,
    confirmation: Type.String({
      description:
        "One sentence stating what you are committing, shown to the operator in the approval prompt. " +
        "When committing with empty metadata, name the empty fields here.",
      minLength: 1,
    }),
    allowEmptyMetadata: Type.Optional(
      Type.Boolean({
        description:
          "Commit even though excerpt, description or summary is empty for some locale. The " +
          "operator sees this flag in the approval prompt.",
      })
    ),
  }),
  executionMode: "sequential",
  async execute(toolCallId, params, _signal, _onUpdate, context) {
    const draft = await context.draft.get(params.draftId);
    // The approved revision when the operator decided on this call; otherwise the one just read.
    const expectedRevision =
      context.approvedDraftRevisions.get(toolCallId) ?? draft.revision;

    // The preflight ran before approval; the draft may have moved since, and the apply service
    // rejects these too. Checking again keeps the error readable rather than an apply failure.
    const blocker = commitBlocker(draft);
    if (blocker) throw new Error(blocker);
    const metadataGaps = metadataGapsOf(draft);

    const result = await context.content.applyDraft({
      draftId: draft.id,
      expectedRevision,
    });

    return textResult(
      `${result.created ? "Created" : "Updated"} feed ${result.feedId} at slug \`${result.slug}\`, ` +
        `still unpublished.${metadataGaps.length > 0 ? `\n\nMetadata still empty — ${metadataGaps.join("; ")}.` : ""}\n\n${jsonBlock(result)}`,
      {
        ...result,
        draftId: draft.id,
        confirmation: params.confirmation,
        metadataGaps,
      }
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
