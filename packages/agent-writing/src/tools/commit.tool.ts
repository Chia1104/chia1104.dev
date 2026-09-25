import * as z from "zod";

import { defineTool, jsonBlock } from "@chia/agent-runtime/tools";
import type { ToolSpec } from "@chia/agent-runtime/tools";
import type {
  ToolCallRefusal,
  ToolCallRequest,
} from "@chia/agent-runtime/types";

import {
  DraftNotFoundError,
  languageMismatch,
  localesOf,
} from "../draft/operations.ts";
import type { FeedDraft, WritingToolContext } from "../types.ts";

import { ToolName } from "./registry.ts";
import { DraftIdSchema } from "./schema.ts";

/** The only tools that touch published data. No delete or image upload. */

/** Why a draft cannot be applied yet; the apply service rejects the same cases. */
const commitBlocker = (draft: FeedDraft): string | undefined => {
  const locales = localesOf(draft.translations);
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

const METADATA_FIELDS = ["excerpt", "description"] as const;

/** Per locale, the optional metadata still empty, as `"en: excerpt, description"`. */
const metadataGapsOf = (draft: FeedDraft): string[] =>
  localesOf(draft.translations).flatMap((locale) => {
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
    if (request.toolName !== ToolName.CommitDraft) return undefined;
    const args = commitArgsSchema.safeParse(request.input);
    if (!args.success) return undefined;

    let draft: FeedDraft;
    try {
      draft = await context.draft.get(args.data.draftId);
    } catch (error) {
      if (error instanceof DraftNotFoundError) {
        return { reason: error.message };
      }
      throw error;
    }

    const blocker = commitBlocker(draft);
    if (blocker) return { reason: blocker };

    const gaps = metadataGapsOf(draft);
    if (gaps.length > 0 && !args.data.allowEmptyMetadata) {
      return {
        reason:
          `Metadata still empty — ${gaps.join("; ")}. Fill it with write_draft, or pass ` +
          "`allowEmptyMetadata: true` and name the empty fields in `confirmation` so the " +
          "operator approves knowingly.",
      };
    }
    return undefined;
  };

export const commitDraftSpec = {
  name: ToolName.CommitDraft,
  description:
    "Apply a draft to the database as an UNPUBLISHED post (or update the post the draft is " +
    "already bound to). Requires human approval. This does NOT publish; use `set_published` " +
    "for that. Refused before approval while excerpt or description is empty for any " +
    "locale, unless `allowEmptyMetadata` is set.",
  parameters: z.object({
    draftId: DraftIdSchema,
    confirmation: z
      .string()
      .min(1)
      .describe(
        "One sentence stating what you are committing, shown to the operator in the approval prompt. " +
          "When committing with empty metadata, name the empty fields here."
      ),
    allowEmptyMetadata: z
      .boolean()
      .describe(
        "Commit even though excerpt or description is empty for some locale. The " +
          "operator sees this flag in the approval prompt."
      )
      .optional(),
  }),
  executionMode: "sequential",
} satisfies ToolSpec;

export const commitDraftTool = defineTool(
  commitDraftSpec,
  (context: WritingToolContext) =>
    async (params, { toolCallId }) => {
      const draft = await context.draft.get(params.draftId);
      // The approved content when the operator decided on this call; otherwise what was just read.
      const expectedHash =
        context.approvedDraftHashes.get(toolCallId) ?? draft.contentHash;

      // The preflight ran before approval; the draft may have moved since, and the apply service
      // rejects these too. Checking again keeps the error readable rather than an apply failure.
      const blocker = commitBlocker(draft);
      if (blocker) throw new Error(blocker);
      const metadataGaps = metadataGapsOf(draft);

      const result = await context.content.applyDraft({
        draftId: draft.id,
        expectedHash,
        message: params.confirmation,
      });

      return {
        text:
          `${result.created ? "Created" : "Updated"} feed ${result.feedId} at slug \`${result.slug}\`, ` +
          `still unpublished.${metadataGaps.length > 0 ? `\n\nMetadata still empty — ${metadataGaps.join("; ")}.` : ""}\n\n${jsonBlock(result)}`,
        details: {
          ...result,
          draftId: draft.id,
          confirmation: params.confirmation,
          metadataGaps,
        },
      };
    }
);

export const setPublishedSpec = {
  name: ToolName.SetPublished,
  description:
    "Publish or unpublish a post. Requires human approval. Publishing makes the post publicly " +
    "visible and triggers reading-time, search-index and embedding jobs. A draft has to be " +
    "committed first; `commit_draft` returns the post's feedId.",
  parameters: z.object({
    feedId: z
      .number()
      .int()
      .describe("The post, as `commit_draft` or `list_posts` reported it."),
    published: z.boolean().describe("`true` to publish, `false` to withdraw."),
    confirmation: z
      .string()
      .min(1)
      .describe(
        "One sentence stating which post and why, shown to the operator in the approval prompt."
      ),
  }),
  executionMode: "sequential",
} satisfies ToolSpec;

export const setPublishedTool = defineTool(
  setPublishedSpec,
  (context: WritingToolContext) => async (params) => {
    const result = await context.content.setPublished({
      feedId: params.feedId,
      published: params.published,
    });

    return {
      text:
        `Feed ${result.feedId} is now ${result.published ? "published" : "unpublished"}.` +
        (result.published
          ? " Indexing (reading time, search, embeddings) runs in the background."
          : ""),
      details: { ...result, confirmation: params.confirmation },
    };
  }
);
