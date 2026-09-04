import { StringEnum } from "@earendil-works/pi-ai";

import { FeedType } from "@chia/db/types";
import type { Locale } from "@chia/db/types";
import { normalizeAsciiSlug } from "@chia/utils/slug";

import {
  DraftConflictError,
  applyEdit,
  withLineNumbers,
} from "../draft/operations.ts";
import type {
  DraftFeedMeta,
  DraftTranslation,
  FeedDraft,
  WritingTool,
} from "../types.ts";

import { TOOL_NAMES, labelOf } from "./registry.ts";
import {
  LocaleSchema,
  Type,
  defineTool,
  jsonBlock,
  textResult,
} from "./schema.ts";

/**
 * Shared-draft tools. Sequential: they mutate shared state, and pi's default is parallel, so
 * two concurrent edits of the same locale would lose one write. None touch published data.
 * The operator edits the same draft from the dashboard, so bodies are written against the
 * revision the model last read.
 */

/** SEO description cap enforced by the site's metadata layer. */
const MAX_DESCRIPTION_CHARS = 160;

/** What `patch_draft_meta` echoes back: the merged state, scoped to the locale it touched. */
interface MetaReadback {
  feedMeta: DraftFeedMeta;
  locales: string[];
  locale?: Locale;
  translation?: Omit<DraftTranslation, "content">;
}

const feedMetaOf = (draft: FeedDraft): DraftFeedMeta => ({
  slug: draft.slug,
  type: draft.type,
  defaultLocale: draft.defaultLocale,
  mainImage: draft.mainImage,
});

export const readDraftTool = defineTool({
  name: TOOL_NAMES.readDraft,
  label: labelOf(TOOL_NAMES.readDraft),
  description:
    "Read the current draft: feed-level metadata plus, for one locale, its metadata and MDX body " +
    "with line numbers. Always read before editing — `edit_draft_content` needs exact text.",
  parameters: Type.Object({
    locale: Type.Optional(
      LocaleSchema(
        "Locale whose body to return. Omit to get metadata and the locale list only."
      )
    ),
  }),
  executionMode: "sequential",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    const draft = await context.draft.get();
    // SAFETY: FeedDraft.translations is keyed exclusively by Locale.
    const locales = Object.keys(draft.translations) as Locale[];
    const feedMeta = feedMetaOf(draft);

    if (!params.locale) {
      return textResult(
        `Draft metadata:\n\n${jsonBlock({
          feedMeta,
          locales,
          feedId: draft.feedId,
          revision: draft.revision,
        })}\n\nCall again with a \`locale\` to read a body.`,
        { feedMeta, locales, revision: draft.revision }
      );
    }

    const locale = params.locale;
    const translation = draft.translations[locale];

    if (!translation) {
      return textResult(
        `No draft yet for locale "${locale}". Existing locales: ${
          locales.length > 0 ? locales.join(", ") : "(none)"
        }. Use write_draft_content to start one.`,
        { locale, exists: false }
      );
    }

    const { content, ...meta } = translation;
    const body = content ?? "";

    return textResult(
      `Draft (${locale}) metadata:\n\n${jsonBlock({ feedMeta, ...meta })}\n\n` +
        `Body (${body.split("\n").length} lines, revision ${draft.revision}):\n\n${
          body.length > 0 ? withLineNumbers(body) : "(empty)"
        }`,
      {
        locale,
        exists: true,
        meta,
        lineCount: body.split("\n").length,
        revision: draft.revision,
      }
    );
  },
});

export const patchDraftMetaTool = defineTool({
  name: TOOL_NAMES.patchDraftMeta,
  label: labelOf(TOOL_NAMES.patchDraftMeta),
  description:
    "Update draft metadata. Omitted fields are left alone; pass `null` to clear an optional field. " +
    "Feed-level fields (slug/type/mainImage/defaultLocale) apply to the whole post; the rest are " +
    "per-locale and require `locale`. The result echoes the merged metadata, so no read-back " +
    "call is needed.",
  parameters: Type.Object({
    locale: Type.Optional(
      LocaleSchema("Required when setting any per-locale field.")
    ),
    title: Type.Optional(Type.String({ description: "Per-locale title." })),
    excerpt: Type.Optional(
      Type.Union([Type.String(), Type.Null()], {
        description: "Per-locale short teaser, 1-2 sentences.",
      })
    ),
    description: Type.Optional(
      Type.Union([Type.String(), Type.Null()], {
        description: `Per-locale SEO meta description. Keep it under ${MAX_DESCRIPTION_CHARS} characters.`,
      })
    ),
    summary: Type.Optional(
      Type.Union([Type.String(), Type.Null()], {
        description: "Per-locale structured summary, 3-5 sentences.",
      })
    ),
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
  }),
  executionMode: "sequential",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    const { locale, title, excerpt, description, summary, ...feedMeta } =
      params;

    const perLocale = { title, excerpt, description, summary };
    const hasPerLocale = Object.values(perLocale).some(
      (value) => value !== undefined
    );

    if (hasPerLocale && !locale) {
      throw new Error(
        "`locale` is required when setting title, excerpt, description or summary."
      );
    }

    const warnings: string[] = [];
    if (
      description !== null &&
      description !== undefined &&
      description.length > MAX_DESCRIPTION_CHARS
    ) {
      warnings.push(
        `description is ${description.length} characters; the site truncates at ${MAX_DESCRIPTION_CHARS}.`
      );
    }

    let draft = await context.draft.get();

    const feedMetaPatch: DraftFeedMeta = { ...feedMeta };
    if (feedMeta.slug !== undefined) {
      const slug = normalizeAsciiSlug(feedMeta.slug);
      if (!slug) {
        throw new Error(
          "`slug` must be an English/ASCII phrase. Slug normalization does not translate or transliterate localized titles."
        );
      }
      feedMetaPatch.slug = slug;
    }

    if (Object.values(feedMetaPatch).some((value) => value !== undefined)) {
      draft = await context.draft.patchFeedMeta(feedMetaPatch);
    }

    if (hasPerLocale && locale) {
      draft = await context.draft.patchTranslation(locale, perLocale);
    }

    // Echo the merged per-locale fields so the model can confirm the patch from this result.
    const readback: MetaReadback = {
      feedMeta: feedMetaOf(draft),
      locales: Object.keys(draft.translations),
    };
    if (locale) {
      const translation = draft.translations[locale];
      readback.locale = locale;
      readback.translation = {
        title: translation?.title,
        excerpt: translation?.excerpt,
        description: translation?.description,
        summary: translation?.summary,
      };
    }

    return textResult(
      `Draft metadata updated.${warnings.length > 0 ? `\n\nWarnings:\n- ${warnings.join("\n- ")}` : ""}\n\n` +
        jsonBlock(readback),
      { ...readback, warnings }
    );
  },
});

export const writeDraftContentTool = defineTool({
  name: TOOL_NAMES.writeDraftContent,
  label: labelOf(TOOL_NAMES.writeDraftContent),
  description:
    "Replace a locale's entire MDX body. Use this to create the first version; prefer " +
    "`edit_draft_content` for revisions so you do not rewrite text that was already reviewed. " +
    "Fails if the operator changed the draft since you last read it; read it again and decide.",
  parameters: Type.Object({
    locale: LocaleSchema("Locale to write."),
    content: Type.String({
      description:
        "The complete MDX body. Do not include frontmatter — metadata is separate.",
    }),
  }),
  executionMode: "sequential",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    // Guard against overwriting an operator edit the model has not seen: the write is pinned
    // to the last revision this turn observed. A fresh draft that was never read still writes.
    const expected =
      context.draft.lastObservedRevision > 0
        ? context.draft.lastObservedRevision
        : undefined;
    const draft = await context.draft.setContent(
      params.locale,
      params.content,
      expected
    );
    const lineCount = params.content.split("\n").length;
    return textResult(
      `Wrote ${params.content.length} characters (${lineCount} lines) to the ${params.locale} draft (revision ${draft.revision}).`,
      {
        locale: params.locale,
        lineCount,
        charCount: params.content.length,
        revision: draft.revision,
      }
    );
  },
});

export const editDraftContentTool = defineTool({
  name: TOOL_NAMES.editDraftContent,
  label: labelOf(TOOL_NAMES.editDraftContent),
  description:
    "Replace an exact string in a locale's MDX body. `oldString` must match the draft byte for " +
    "byte, including indentation. If it matches more than once the call fails — add surrounding " +
    "context to disambiguate, or pass `replaceAll`.",
  parameters: Type.Object({
    locale: LocaleSchema("Locale to edit."),
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
  executionMode: "sequential",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    const locale = params.locale;

    // Read-apply-write pinned to the revision read. If the operator saved in between, the
    // edit is re-applied on the new body once: an exact-string edit usually still lands.
    for (let attempt = 0; ; attempt += 1) {
      const draft = await context.draft.get();
      const current = draft.translations[locale]?.content;

      if (current === undefined || current === null) {
        throw new Error(
          `No draft body for locale "${locale}" yet. Use write_draft_content first.`
        );
      }

      const result = applyEdit(
        current,
        params.oldString,
        params.newString,
        params.replaceAll ?? false
      );

      try {
        const next = await context.draft.setContent(
          locale,
          result.content,
          draft.revision
        );
        return textResult(
          `Applied ${result.replacements} replacement(s) to the ${locale} draft (revision ${next.revision}).`,
          {
            locale,
            replacements: result.replacements,
            revision: next.revision,
            // Enough for the UI to render a diff without shipping both full bodies.
            oldString: params.oldString,
            newString: params.newString,
          }
        );
      } catch (error) {
        if (error instanceof DraftConflictError && attempt === 0) continue;
        throw error;
      }
    }
  },
});

export const draftTools: WritingTool[] = [
  readDraftTool,
  patchDraftMetaTool,
  writeDraftContentTool,
  editDraftContentTool,
];
