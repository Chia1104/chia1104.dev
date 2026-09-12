import { StringEnum } from "@earendil-works/pi-ai";

import { FeedType, Locale } from "@chia/db/types";
import { normalizeAsciiSlug } from "@chia/utils/slug";
import { numberLines } from "@chia/utils/text";

import { languageMismatch } from "../draft/operations.ts";
import type {
  DraftFeedMeta,
  DraftTranslation,
  DraftWrite,
  FeedDraft,
  WritingTool,
} from "../types.ts";

import { TOOL_NAMES, labelOf } from "./registry.ts";
import {
  DraftIdSchema,
  LocaleSchema,
  Type,
  defineTool,
  jsonBlock,
  textResult,
} from "./schema.ts";

/**
 * Shared-draft tools, addressed by `draftId`. Sequential: they mutate shared state, and pi's
 * default is parallel, so two concurrent edits of the same locale would lose one write. None
 * touch published data. The operator edits the same drafts from the dashboard, so bodies are
 * written against the revision the model last read.
 */

/** SEO description cap enforced by the site's metadata layer. */
const MAX_DESCRIPTION_CHARS = 160;

/** What `write_draft` echoes back: the merged state, with the metadata of every locale it touched. */
interface WriteReadback {
  draftId: number;
  revision: number;
  feedMeta: DraftFeedMeta;
  locales: string[];
  translations: Partial<
    Record<Locale, Omit<DraftTranslation, "content"> & { lineCount?: number }>
  >;
}

const feedMetaOf = (draft: FeedDraft): DraftFeedMeta => ({
  slug: draft.slug,
  type: draft.type,
  defaultLocale: draft.defaultLocale,
  mainImage: draft.mainImage,
});

export const listDraftsTool = defineTool({
  name: TOOL_NAMES.listDrafts,
  label: labelOf(TOOL_NAMES.listDrafts),
  description:
    "List the open drafts: new posts not yet committed, and posts edited since their last " +
    "commit. Each row carries the `draftId` the other draft tools take.",
  parameters: Type.Object({}),
  async execute(_toolCallId, _params, _signal, _onUpdate, context) {
    const drafts = await context.draft.list();
    if (drafts.length === 0) {
      return textResult(
        "No open drafts. `new_draft` starts one for a new post; `open_draft` opens an existing post's by feedId.",
        { drafts }
      );
    }
    return textResult(`Open drafts:\n\n${jsonBlock(drafts)}`, { drafts });
  },
});

const openedResult = (draft: FeedDraft) => {
  const locales = Object.keys(draft.translations);
  return textResult(
    `Opened draft ${draft.id} ${draft.feedId === null ? "for a new post" : `for feed ${draft.feedId}`} ` +
      `(revision ${draft.revision}). Use draftId ${draft.id} with the other draft tools.\n\n` +
      jsonBlock({ feedMeta: feedMetaOf(draft), locales }),
    {
      draftId: draft.id,
      feedId: draft.feedId,
      revision: draft.revision,
      locales,
    }
  );
};

/**
 * Two tools, not one optional id: a model that must send a number for "no post" sends `0`,
 * and one that may omit it guesses. A new post has nothing to identify it, so its tool takes
 * nothing.
 */
export const newDraftTool = defineTool({
  name: TOOL_NAMES.newDraft,
  label: labelOf(TOOL_NAMES.newDraft),
  description:
    "Start an empty draft for a new post that does not exist yet. Takes no arguments: a new " +
    "post has no id. Check `list_drafts` first so an existing empty draft is reused, and use " +
    "`open_draft` for a post that already exists.",
  parameters: Type.Object({}),
  executionMode: "sequential",
  async execute(_toolCallId, _params, _signal, _onUpdate, context) {
    return openedResult(await context.draft.open({}));
  },
});

export const openDraftTool = defineTool({
  name: TOOL_NAMES.openDraft,
  label: labelOf(TOOL_NAMES.openDraft),
  description:
    "Open an existing post's working draft, creating it from the post when there is none. A " +
    "post has one draft, shared with the operator. For a post that does not exist yet use " +
    "`new_draft` instead; there is no id to pass.",
  parameters: Type.Object({
    feedId: Type.Integer({
      description:
        "The post's id, as `list_posts` or `search_posts` reported it. Never guess one.",
      minimum: 1,
    }),
  }),
  executionMode: "sequential",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    return openedResult(await context.draft.open({ feedId: params.feedId }));
  },
});

export const readDraftTool = defineTool({
  name: TOOL_NAMES.readDraft,
  label: labelOf(TOOL_NAMES.readDraft),
  description:
    "Read a draft: feed-level metadata plus, for one locale, its metadata and MDX body with " +
    "line numbers. Read once to locate text before `edit_draft_content`; its result shows where " +
    "each edit landed, so no read-back is needed.",
  parameters: Type.Object({
    draftId: DraftIdSchema,
    locale: Type.Optional(
      LocaleSchema(
        "Locale whose body to return. Omit to get metadata and the locale list only."
      )
    ),
  }),
  executionMode: "sequential",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    const draft = await context.draft.get(params.draftId);
    // SAFETY: FeedDraft.translations is keyed exclusively by Locale.
    const locales = Object.keys(draft.translations) as Locale[];
    const feedMeta = feedMetaOf(draft);

    if (!params.locale) {
      return textResult(
        `Draft ${draft.id} metadata:\n\n${jsonBlock({
          feedMeta,
          locales,
          feedId: draft.feedId,
          revision: draft.revision,
        })}\n\nCall again with a \`locale\` to read a body.`,
        { draftId: draft.id, feedMeta, locales, revision: draft.revision }
      );
    }

    const locale = params.locale;
    const translation = draft.translations[locale];

    if (!translation) {
      return textResult(
        `No draft yet for locale "${locale}". Existing locales: ${
          locales.length > 0 ? locales.join(", ") : "(none)"
        }. Use write_draft to start one.`,
        { draftId: draft.id, locale, exists: false }
      );
    }

    const { content, ...meta } = translation;
    const body = content ?? "";

    return textResult(
      `Draft ${draft.id} (${locale}) metadata:\n\n${jsonBlock({ feedMeta, ...meta })}\n\n` +
        `Body (${body.split("\n").length} lines, revision ${draft.revision}):\n\n${
          body.length > 0 ? numberLines(body) : "(empty)"
        }`,
      {
        draftId: draft.id,
        locale,
        exists: true,
        meta,
        lineCount: body.split("\n").length,
        revision: draft.revision,
      }
    );
  },
});

const TranslationWriteSchema = Type.Object({
  title: Type.Optional(Type.String({ description: "Title." })),
  excerpt: Type.Optional(
    Type.Union([Type.String(), Type.Null()], {
      description: "Short teaser, 1-2 sentences.",
    })
  ),
  description: Type.Optional(
    Type.Union([Type.String(), Type.Null()], {
      description: `SEO meta description. Keep it under ${MAX_DESCRIPTION_CHARS} characters.`,
    })
  ),
  summary: Type.Optional(
    Type.Union([Type.String(), Type.Null()], {
      description: "Structured summary, 3-5 sentences.",
    })
  ),
  content: Type.Optional(
    Type.String({
      description:
        "The complete MDX body. No frontmatter — metadata is the other fields. Replaces the " +
        "whole body; prefer edit_draft_content for revisions.",
    })
  ),
});

/** One optional entry per supported locale; TypeBox has no partial record over a literal union. */
const TranslationsWriteSchema = Type.Object(
  Object.fromEntries(
    Object.values(Locale).map((locale) => [
      locale,
      Type.Optional(TranslationWriteSchema),
    ])
  ),
  {
    description:
      "Per-locale fields keyed by locale. Omitted fields are left alone; `null` clears one.",
  }
);

export const writeDraftTool = defineTool({
  name: TOOL_NAMES.writeDraft,
  label: labelOf(TOOL_NAMES.writeDraft),
  description:
    "Write a draft: feed-level fields and any number of locales, each with metadata and/or the " +
    "whole MDX body, as one revision. Use it to create a post in one call (both locales, all " +
    "metadata) or to set metadata later. Each locale's body is prose in that locale's " +
    "language; a body written in the other language is refused. Omitted fields are left " +
    "alone; `null` clears an optional one. A body write fails if the operator changed the " +
    "draft since you last read it; read it again and decide. The result echoes the merged " +
    "metadata, so no read-back is needed.",
  parameters: Type.Object({
    draftId: DraftIdSchema,
    slug: Type.Optional(
      Type.String({
        description:
          "English/ASCII URL slug for the whole post. It is lowercased and hyphenated on write; " +
          "the result echoes the final form. This field does not translate a localized title.",
      })
    ),
    type: Type.Optional(
      StringEnum([FeedType.Post, FeedType.Note], {
        description: "`post` for articles, `note` for short-form entries.",
      })
    ),
    mainImage: Type.Optional(
      Type.Union([Type.String(), Type.Null()], {
        description:
          "Absolute cover image URL. You cannot upload — only reference.",
      })
    ),
    defaultLocale: Type.Optional(LocaleSchema("Canonical locale of the post.")),
    translations: Type.Optional(TranslationsWriteSchema),
  }),
  executionMode: "sequential",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    const { draftId, translations, ...feedMeta } = params;

    const meta: DraftFeedMeta = { ...feedMeta };
    if (feedMeta.slug !== undefined) {
      const slug = normalizeAsciiSlug(feedMeta.slug);
      if (!slug) {
        throw new Error(
          "`slug` must be an English/ASCII phrase. Slug normalization does not translate or transliterate localized titles."
        );
      }
      meta.slug = slug;
    }

    const warnings: string[] = [];
    const writes: NonNullable<DraftWrite["translations"]> = {};
    let writesBody = false;
    for (const [locale, patch] of Object.entries(translations ?? {})) {
      // `{ en: {} }` is schema-valid and writes nothing; keep it out so the result is honest.
      if (
        !patch ||
        Object.values(patch).every((value) => value === undefined)
      ) {
        continue;
      }
      // SAFETY: TranslationsWriteSchema is keyed by Locale.
      const key = locale as Locale;
      if (patch.content !== undefined) {
        const mismatch = languageMismatch(key, patch.content);
        if (mismatch) throw new Error(mismatch);
        writesBody = true;
      }
      writes[key] = patch;
      if (
        patch.description !== null &&
        patch.description !== undefined &&
        patch.description.length > MAX_DESCRIPTION_CHARS
      ) {
        warnings.push(
          `${locale} description is ${patch.description.length} characters; the site truncates at ${MAX_DESCRIPTION_CHARS}.`
        );
      }
    }

    if (
      Object.values(meta).every((value) => value === undefined) &&
      Object.keys(writes).length === 0
    ) {
      throw new Error(
        "Nothing to write: pass feed-level fields or translations."
      );
    }

    // A whole-body write is pinned to the last revision this turn observed so it cannot bury
    // an operator edit the model has not seen. Metadata alone merges field by field and needs
    // no pin; a draft never read still writes.
    const expected = writesBody
      ? context.draft.observedRevisions.get(draftId)
      : undefined;
    const draft = await context.draft.write(
      draftId,
      { meta, translations: writes },
      expected
    );

    const readback: WriteReadback = {
      draftId,
      revision: draft.revision,
      feedMeta: feedMetaOf(draft),
      locales: Object.keys(draft.translations),
      translations: {},
    };
    for (const locale of Object.keys(writes)) {
      // SAFETY: `writes` is keyed by Locale.
      const key = locale as Locale;
      const translation = draft.translations[key];
      const written: WriteReadback["translations"][Locale] = {
        title: translation?.title,
        excerpt: translation?.excerpt,
        description: translation?.description,
        summary: translation?.summary,
      };
      const content = writes[key]?.content;
      if (content !== undefined && content !== null) {
        written.lineCount = content.split("\n").length;
      }
      readback.translations[key] = written;
    }

    return textResult(
      `Draft ${draftId} written (revision ${draft.revision}).${warnings.length > 0 ? `\n\nWarnings:\n- ${warnings.join("\n- ")}` : ""}\n\n` +
        jsonBlock(readback),
      { ...readback, warnings }
    );
  },
});

export const editDraftContentTool = defineTool({
  name: TOOL_NAMES.editDraftContent,
  label: labelOf(TOOL_NAMES.editDraftContent),
  description:
    "Replace exact strings in a locale's MDX body. Edits apply in order as one revision; each " +
    "`oldString` must match the draft byte for byte, including indentation. A target that " +
    "matches more than once fails unless `replaceAll`; a failed edit refuses the whole batch. " +
    "The result shows the numbered lines around each edit, so no read-back is needed.",
  parameters: Type.Object({
    draftId: DraftIdSchema,
    locale: LocaleSchema("Locale to edit."),
    edits: Type.Array(
      Type.Object({
        oldString: Type.String({
          description: "Exact existing text to replace.",
          minLength: 1,
        }),
        newString: Type.String({
          description: "Replacement text. Pass an empty string to delete.",
        }),
        replaceAll: Type.Optional(
          Type.Boolean({
            description:
              "Replace every occurrence instead of failing on ambiguity.",
            default: false,
          })
        ),
      }),
      { minItems: 1, maxItems: 50, description: "Applied in this order." }
    ),
  }),
  executionMode: "sequential",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    const { draftId, locale } = params;
    // Matched under the draft lock against whatever body is current, so an operator save in
    // between is edited rather than overwritten.
    const { draft, edits } = await context.draft.editContent(
      draftId,
      locale,
      params.edits
    );
    const replacements = edits.reduce(
      (sum, edit) => sum + edit.replacements,
      0
    );
    const where = edits
      .map(
        (edit, index) =>
          `Edit ${index + 1} — line ${edit.line}, ${edit.replacements} replacement(s):\n${edit.context}`
      )
      .join("\n\n");
    // The edit has landed; a body now in the wrong language is reported, and blocks the commit.
    const warning =
      languageMismatch(locale, draft.translations[locale]?.content ?? "") ??
      null;
    return textResult(
      `Applied ${replacements} replacement(s) across ${edits.length} edit(s) to draft ${draftId} (${locale}, revision ${draft.revision}).` +
        `${warning ? `\n\nWarning: ${warning}` : ""}\n\n${where}`,
      {
        draftId,
        locale,
        replacements,
        revision: draft.revision,
        warning,
        // Enough for the UI to render a diff without shipping both full bodies.
        edits: params.edits.map((edit, index) => ({
          oldString: edit.oldString,
          newString: edit.newString,
          replacements: edits[index]?.replacements ?? 0,
          line: edits[index]?.line ?? null,
        })),
      }
    );
  },
});

export const draftTools: WritingTool[] = [
  listDraftsTool,
  newDraftTool,
  openDraftTool,
  readDraftTool,
  writeDraftTool,
  editDraftContentTool,
];
