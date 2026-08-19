import { StringEnum } from "@earendil-works/pi-ai";
import GithubSlugger from "github-slugger";

import { ContentType, FeedType } from "@chia/db/types";
import type { Locale } from "@chia/db/types";

import { applyEdit, withLineNumbers } from "../draft/operations.ts";
import type { DraftFeedMeta, DraftTranslation, WritingTool } from "../types.ts";

import { TOOL_NAMES, labelOf } from "./registry.ts";
import {
  LocaleSchema,
  Type,
  defineTool,
  jsonBlock,
  textResult,
} from "./schema.ts";

/**
 * Tier 2 — the staging buffer.
 *
 * Every one of these is `executionMode: "sequential"`. They mutate shared state, and pi's
 * default is parallel execution: two concurrent `edit_draft_content` calls against the same
 * locale would interleave read-modify-write and silently lose one edit.
 *
 * None of them touch published data, so none require approval.
 */

/**
 * A fresh slugger per call, never a shared instance.
 *
 * `GithubSlugger` remembers what it has emitted and disambiguates repeats by appending `-1`,
 * `-2`, … A module-level instance would therefore turn the same title into a *different* slug on
 * every call, which is exactly wrong for an idempotent normalisation.
 */
const slugify = (text: string): string => new GithubSlugger().slug(text);

/** SEO description cap enforced by the site's metadata layer. */
const MAX_DESCRIPTION_CHARS = 160;

/** What `patch_draft_meta` echoes back: the merged state, scoped to the locale it touched. */
interface MetaReadback {
  feedMeta: DraftFeedMeta;
  locales: string[];
  locale?: Locale;
  translation?: Omit<DraftTranslation, "content">;
}

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
    const draft = await context.draft.get(context.agentSessionId);
    // SAFETY: FeedDraft.translations is keyed exclusively by Locale.
    const locales = Object.keys(draft.translations) as Locale[];

    if (!params.locale) {
      return textResult(
        `Draft metadata:\n\n${jsonBlock({
          feedMeta: draft.feedMeta,
          locales,
          committedFeedId: draft.committedFeedId,
        })}\n\nCall again with a \`locale\` to read a body.`,
        { feedMeta: draft.feedMeta, locales }
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
      `Draft (${locale}) metadata:\n\n${jsonBlock({ feedMeta: draft.feedMeta, ...meta })}\n\n` +
        `Body (${body.split("\n").length} lines):\n\n${
          body.length > 0 ? withLineNumbers(body) : "(empty)"
        }`,
      { locale, exists: true, meta, lineCount: body.split("\n").length }
    );
  },
});

export const patchDraftMetaTool = defineTool({
  name: TOOL_NAMES.patchDraftMeta,
  label: labelOf(TOOL_NAMES.patchDraftMeta),
  description:
    "Update draft metadata. Omitted fields are left alone; pass `null` to clear an optional field. " +
    "Feed-level fields (slug/type/tags) apply to the whole post; the rest are per-locale and " +
    "require `locale`. The result echoes the merged metadata, so no read-back call is needed.",
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
          "URL slug for the whole post. Normalised on write; the result echoes the final form. " +
          "Use `slugify` only to compare candidates beforehand.",
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
    tagSlugs: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Suggested tag slugs. Recorded for the operator; NOT attached on commit.",
      })
    ),
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

    let draft = await context.draft.get(context.agentSessionId);

    const feedMetaPatch = { ...feedMeta };
    if (feedMeta.slug !== undefined)
      feedMetaPatch.slug = slugify(feedMeta.slug);

    if (Object.values(feedMetaPatch).some((value) => value !== undefined)) {
      draft = await context.draft.patchFeedMeta(
        context.agentSessionId,
        feedMetaPatch
      );
    }

    if (hasPerLocale && locale) {
      draft = await context.draft.patchTranslation(
        context.agentSessionId,
        locale,
        perLocale
      );
    }

    // Echo the merged per-locale fields so the model can confirm the patch from this result
    // instead of spending a `read_draft` round-trip on it.
    const readback: MetaReadback = {
      feedMeta: draft.feedMeta,
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
    "`edit_draft_content` for revisions so you do not rewrite text that was already reviewed.",
  parameters: Type.Object({
    locale: LocaleSchema("Locale to write."),
    content: Type.String({
      description:
        "The complete MDX body. Do not include frontmatter — metadata is separate.",
    }),
  }),
  executionMode: "sequential",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    await context.draft.setContent(
      context.agentSessionId,
      params.locale,
      params.content
    );
    const lineCount = params.content.split("\n").length;
    return textResult(
      `Wrote ${params.content.length} characters (${lineCount} lines) to the ${params.locale} draft.`,
      { locale: params.locale, lineCount, charCount: params.content.length }
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
    const draft = await context.draft.get(context.agentSessionId);
    const current = draft.translations[locale]?.content;

    if (current === undefined) {
      throw new Error(
        `No draft body for locale "${locale}" yet. Use write_draft_content first.`
      );
    }

    // applyEdit throws EditNotAppliedError on miss/ambiguity — pi turns a thrown error into
    // an error tool result, which is exactly the signal the model needs.
    const result = applyEdit(
      current,
      params.oldString,
      params.newString,
      params.replaceAll ?? false
    );

    await context.draft.setContent(
      context.agentSessionId,
      locale,
      result.content
    );

    return textResult(
      `Applied ${result.replacements} replacement(s) to the ${locale} draft.`,
      {
        locale,
        replacements: result.replacements,
        // Enough for the UI to render a diff without shipping both full bodies.
        oldString: params.oldString,
        newString: params.newString,
      }
    );
  },
});

export const slugifyTool = defineTool({
  name: TOOL_NAMES.slugify,
  label: labelOf(TOOL_NAMES.slugify),
  description:
    "Normalise a string into a URL slug using the exact same slugger the server uses, so you can " +
    "see the final slug before setting it. Deterministic — no model call.",
  parameters: Type.Object({
    text: Type.String({ description: "Text to slugify, usually the title." }),
  }),
  executionMode: "parallel",
  execute(_toolCallId, params) {
    const slug = slugify(params.text);
    return Promise.resolve(
      textResult(`Slug: \`${slug}\``, { slug, input: params.text })
    );
  },
});

export const draftTools: WritingTool[] = [
  readDraftTool,
  patchDraftMetaTool,
  writeDraftContentTool,
  editDraftContentTool,
  slugifyTool,
];

/** Re-exported so `commit.tool.ts` can reuse the same default. */
export const DEFAULT_CONTENT_TYPE = ContentType.Mdx;
