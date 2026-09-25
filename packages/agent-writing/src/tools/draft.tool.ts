import { sumBy } from "es-toolkit";
import * as z from "zod";

import { defineTool, jsonBlock } from "@chia/agent-runtime/tools";
import type { ToolSpec } from "@chia/agent-runtime/tools";
import { extractSections } from "@chia/ai/embeddings/markdown";
import type { MarkdownSectionSpan } from "@chia/ai/embeddings/markdown";
import { FeedType, Locale } from "@chia/db/types";
import { isEnumValue } from "@chia/utils/is";
import { normalizeAsciiSlug } from "@chia/utils/slug";
import { MatchMode, numberLines } from "@chia/utils/text";

import {
  languageMismatch,
  localesOf,
  noBodyMessage,
} from "../draft/operations.ts";
import type {
  DraftFeedMeta,
  DraftTranslation,
  DraftWrite,
  FeedDraft,
  WritingToolContext,
} from "../types.ts";

import { ToolName } from "./registry.ts";
import { DraftIdSchema } from "./schema.ts";

/**
 * Shared-draft tools, addressed by `draftId`. None touch published data. The operator edits the
 * same drafts from the dashboard, so bodies are written against the revision the model last
 * read.
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

export const listDraftsSpec = {
  name: ToolName.ListDrafts,
  description:
    "List the open drafts: new posts not yet committed, and posts edited since their last " +
    "commit. Each row carries the `draftId` the other draft tools take.",
  parameters: z.object({}),
} satisfies ToolSpec;

export const listDraftsTool = defineTool(
  listDraftsSpec,
  (context: WritingToolContext) => async () => {
    const drafts = await context.draft.list();
    if (drafts.length === 0) {
      return {
        text: "No open drafts. `new_draft` starts one for a new post; `open_draft` opens an existing post's by feedId.",
        details: { drafts },
      };
    }
    return {
      text: `Open drafts:\n\n${jsonBlock(drafts)}`,
      details: { drafts },
    };
  }
);

const openedResult = (draft: FeedDraft) => {
  const locales = Object.keys(draft.translations);
  return {
    text:
      `Opened draft ${draft.id} ${draft.feedId === null ? "for a new post" : `for feed ${draft.feedId}`} ` +
      `(revision ${draft.revision}). Use draftId ${draft.id} with the other draft tools.\n\n` +
      jsonBlock({ feedMeta: feedMetaOf(draft), locales }),
    details: {
      draftId: draft.id,
      feedId: draft.feedId,
      revision: draft.revision,
      locales,
    },
  };
};

/**
 * Two tools, not one optional id: a model that must send a number for "no post" sends `0`,
 * and one that may omit it guesses. A new post has nothing to identify it, so its tool takes
 * nothing.
 */
export const newDraftSpec = {
  name: ToolName.NewDraft,
  description:
    "Start an empty draft for a new post that does not exist yet. Takes no arguments: a new " +
    "post has no id. Check `list_drafts` first so an existing empty draft is reused, and use " +
    "`open_draft` for a post that already exists.",
  parameters: z.object({}),
  executionMode: "sequential",
} satisfies ToolSpec;

export const newDraftTool = defineTool(
  newDraftSpec,
  (context: WritingToolContext) => async () => {
    return openedResult(await context.draft.open({}));
  }
);

export const openDraftSpec = {
  name: ToolName.OpenDraft,
  description:
    "Open an existing post's working draft, creating it from the post when there is none. A " +
    "post has one draft, shared with the operator. For a post that does not exist yet use " +
    "`new_draft` instead; there is no id to pass.",
  parameters: z.object({
    feedId: z
      .number()
      .int()
      .min(1)
      .describe(
        "The post's id, as `list_posts` or `search_posts` reported it. Never guess one."
      ),
  }),
  executionMode: "sequential",
} satisfies ToolSpec;

export const openDraftTool = defineTool(
  openDraftSpec,
  (context: WritingToolContext) => async (params) => {
    return openedResult(await context.draft.open({ feedId: params.feedId }));
  }
);

/** `"Setup > Install"`, as the outline lists it and `replace_section` takes it. */
const HeadingSchema = z
  .string()
  .min(1)
  .describe(
    "A heading path from the body's outline, ancestors joined with ` > `, e.g. " +
      '`"Setup > Install"`. Copy it as listed.'
  );

const outlineOf = (sections: readonly MarkdownSectionSpan[]): string =>
  sections.length === 0
    ? "(no headings)"
    : sections
        .map(
          (section) =>
            `line ${section.line} (h${section.level}): ${section.path}`
        )
        .join("\n");

/**
 * The one section at `heading`; a miss or a duplicate path is refused with the way forward.
 * `onDuplicate` names the caller's alternative, since a duplicate path cannot address a section.
 */
const sectionAt = (
  sections: readonly MarkdownSectionSpan[],
  heading: string,
  onDuplicate: string
): MarkdownSectionSpan => {
  const found = sections.filter((section) => section.path === heading);
  const [only, ...others] = found;
  if (only && others.length === 0) return only;
  if (!only) {
    throw new Error(
      `No section at heading "${heading}". The outline is:\n${outlineOf(sections)}`
    );
  }
  throw new Error(
    `Heading "${heading}" names ${found.length} sections (lines ${found.map((section) => section.line).join(", ")}). ${onDuplicate}`
  );
};

const LineSchema = (description: string) =>
  z.number().int().min(1).describe(description);

const MATCH_NOTE = {
  exact: "",
  trailing_whitespace: " (matched ignoring whitespace at line ends)",
  whitespace: " (matched ignoring whitespace at line edges)",
  punctuation: " (matched reading curly quotes, dashes or spaces as ASCII)",
} satisfies Record<MatchMode, string>;

export const readDraftSpec = {
  name: ToolName.ReadDraft,
  description:
    "Read a draft: feed-level metadata plus, for one locale, its metadata, the outline of its " +
    "headings and its MDX body with line numbers. All of `heading`, `fromLine` and `toLine` " +
    "are optional and combine: `heading` narrows the body to one section, `fromLine`/`toLine` " +
    "to a line range, and both together to the part of the section inside the range. Omit " +
    "all three for the whole body. Read once to locate text before `edit_draft_content` or " +
    "`replace_section`; their results show where each edit landed, so no read-back is needed.",
  parameters: z.object({
    draftId: DraftIdSchema,
    locale: z
      .enum(Locale)
      .describe(
        "Locale whose body to return. Omit to get metadata and the locale list only."
      )
      .optional(),
    heading: HeadingSchema.optional(),
    fromLine: LineSchema(
      "First body line to return, 1-based. Omit to start at line 1."
    ).optional(),
    toLine: LineSchema(
      "Last body line to return, inclusive. Omit to read to the end."
    ).optional(),
  }),
  executionMode: "sequential",
} satisfies ToolSpec;

export const readDraftTool = defineTool(
  readDraftSpec,
  (context: WritingToolContext) => async (params) => {
    const draft = await context.draft.get(params.draftId);
    const locales = Object.keys(draft.translations);
    const feedMeta = feedMetaOf(draft);

    if (!params.locale) {
      return {
        text: `Draft ${draft.id} metadata:\n\n${jsonBlock({
          feedMeta,
          locales,
          feedId: draft.feedId,
          revision: draft.revision,
        })}\n\nCall again with a \`locale\` to read a body.`,
        details: {
          draftId: draft.id,
          feedMeta,
          locales,
          revision: draft.revision,
        },
      };
    }

    const locale = params.locale;
    const translation = draft.translations[locale];

    if (!translation) {
      return {
        text: `No draft yet for locale "${locale}". Existing locales: ${
          locales.length > 0 ? locales.join(", ") : "(none)"
        }. Use write_draft to start one.`,
        details: { draftId: draft.id, locale, exists: false },
      };
    }

    const { content, ...meta } = translation;
    const body = content ?? "";
    const bodyLines = body.split("\n");
    const sections = await extractSections(body);
    const head = `Draft ${draft.id} (${locale}) metadata:\n\n${jsonBlock({ feedMeta, ...meta })}\n\n`;
    const details = {
      draftId: draft.id,
      locale,
      exists: true,
      meta,
      revision: draft.revision,
      outline: sections.map((section) => ({
        line: section.line,
        level: section.level,
        path: section.path,
      })),
    };

    const { heading, fromLine, toLine } = params;
    if (heading || fromLine !== undefined || toLine !== undefined) {
      const section = heading
        ? sectionAt(
            sections,
            heading,
            "Read it by `fromLine`/`toLine` from the outline instead."
          )
        : undefined;
      const sectionTo = section
        ? section.line +
          body.slice(section.start, section.end).split("\n").length -
          1
        : bodyLines.length;
      const from = Math.max(fromLine ?? 1, section?.line ?? 1);
      const to = Math.min(toLine ?? bodyLines.length, sectionTo);
      if (from > to) {
        throw new Error(
          section
            ? `Lines ${fromLine ?? 1}-${toLine ?? bodyLines.length} fall outside section "${section.path}" (lines ${section.line}-${sectionTo}). Drop \`fromLine\`/\`toLine\` to read the whole section.`
            : `Lines ${fromLine ?? 1}-${toLine ?? bodyLines.length} are outside the body (${bodyLines.length} lines).`
        );
      }
      const text = bodyLines.slice(from - 1, to).join("\n");
      const scope = section ? `Section "${section.path}", lines` : "Lines";
      return {
        text: `${head}${scope} ${from}-${to} of ${bodyLines.length} (revision ${draft.revision}):\n\n${numberLines(text, from)}`,
        details: {
          ...details,
          heading: section?.path ?? null,
          lines: { from, to },
          lineCount: to - from + 1,
        },
      };
    }

    return {
      text:
        `${head}Outline:\n\n${outlineOf(sections)}\n\n` +
        `Body (${bodyLines.length} lines, revision ${draft.revision}):\n\n${
          body.length > 0 ? numberLines(body) : "(empty)"
        }`,
      details: { ...details, lineCount: bodyLines.length },
    };
  }
);

/**
 * An optional parameter is offered to the model as nullable, and its `null` means "leave it", so
 * clearing a field takes an empty string instead.
 */
const clearable = (value: string | undefined): string | null | undefined =>
  value === "" ? null : value;

const TranslationWriteSchema = z.object({
  title: z.string().describe("Title.").optional(),
  excerpt: z
    .string()
    .describe("Short teaser, 1-2 sentences. An empty string clears it.")
    .optional(),
  description: z
    .string()
    .describe(
      `SEO meta description. Keep it under ${MAX_DESCRIPTION_CHARS} characters. An empty ` +
        "string clears it."
    )
    .optional(),
  content: z
    .string()
    .describe(
      "The complete MDX body. No frontmatter — metadata is the other fields. Replaces the " +
        "whole body; prefer edit_draft_content for revisions."
    )
    .optional(),
});

/**
 * One optional entry per supported locale, spelled out as properties: a record reaches the model
 * as an open map that names no locale.
 */
const TranslationsWriteSchema = z
  .object(
    Object.fromEntries(
      Object.values(Locale).map((locale) => [
        locale,
        TranslationWriteSchema.optional(),
      ])
    )
  )
  .describe(
    "Per-locale fields keyed by locale. Omitted or `null` fields are left alone."
  );

export const writeDraftSpec = {
  name: ToolName.WriteDraft,
  description:
    "Write a draft: feed-level fields and any number of locales, each with metadata and/or the " +
    "whole MDX body, as one revision. Use it to create a post in one call (both locales, all " +
    "metadata) or to set metadata later. Each locale's body is prose in that locale's " +
    "language; a body written in the other language is refused. Omitted or `null` fields are " +
    "left alone; an empty string clears an optional one. A body write fails if the operator changed the " +
    "draft since you last read it; read it again and decide. The result echoes the merged " +
    "metadata, so no read-back is needed.",
  parameters: z.object({
    draftId: DraftIdSchema,
    slug: z
      .string()
      .describe(
        "English/ASCII URL slug for the whole post. It is lowercased and hyphenated on write; " +
          "the result echoes the final form. This field does not translate a localized title."
      )
      .optional(),
    type: z
      .enum([FeedType.Post, FeedType.Note])
      .describe("`post` for articles, `note` for short-form entries.")
      .optional(),
    mainImage: z
      .string()
      .describe(
        "Absolute cover image URL. You cannot upload — only reference. An empty string clears it."
      )
      .optional(),
    defaultLocale: z
      .enum(Locale)
      .describe("Canonical locale of the post.")
      .optional(),
    translations: TranslationsWriteSchema.optional(),
  }),
  executionMode: "sequential",
} satisfies ToolSpec;

export const writeDraftTool = defineTool(
  writeDraftSpec,
  (context: WritingToolContext) => async (params) => {
    const { draftId, translations, ...feedMeta } = params;

    const meta: DraftFeedMeta = {
      ...feedMeta,
      mainImage: clearable(feedMeta.mainImage),
    };
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
    for (const [locale, patch] of Object.entries(translations ?? {})) {
      // `{ en: {} }` is schema-valid and writes nothing; keep it out so the result is honest.
      if (
        !patch ||
        Object.values(patch).every((value) => value === undefined)
      ) {
        continue;
      }
      if (!isEnumValue(Locale, locale)) {
        throw new Error(
          `No locale "${locale}"; key translations by ${Object.values(Locale).join(" or ")}.`
        );
      }
      if (patch.content !== undefined) {
        const mismatch = languageMismatch(locale, patch.content);
        if (mismatch) throw new Error(mismatch);
      }
      writes[locale] = {
        ...patch,
        excerpt: clearable(patch.excerpt),
        description: clearable(patch.description),
      };
      if (
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

    const draft = await context.draft.write(draftId, {
      meta,
      translations: writes,
    });

    const readback: WriteReadback = {
      draftId,
      revision: draft.revision,
      feedMeta: feedMetaOf(draft),
      locales: Object.keys(draft.translations),
      translations: {},
    };
    for (const locale of localesOf(writes)) {
      const translation = draft.translations[locale];
      const written: WriteReadback["translations"][Locale] = {
        title: translation?.title,
        excerpt: translation?.excerpt,
        description: translation?.description,
      };
      const content = writes[locale]?.content;
      if (content !== undefined && content !== null) {
        written.lineCount = content.split("\n").length;
      }
      readback.translations[locale] = written;
    }

    return {
      text:
        `Draft ${draftId} written (revision ${draft.revision}).${warnings.length > 0 ? `\n\nWarnings:\n- ${warnings.join("\n- ")}` : ""}\n\n` +
        jsonBlock(readback),
      details: { ...readback, warnings },
    };
  }
);

export const editDraftContentSpec = {
  name: ToolName.EditDraftContent,
  description:
    "Replace exact strings in a locale's MDX body. Edits apply in order as one revision; each " +
    "`oldString` must match the draft byte for byte, including indentation. A target that " +
    "matches more than once fails unless `replaceAll`; a failed edit refuses the whole batch. " +
    "The result shows the numbered lines around each edit, so no read-back is needed.",
  parameters: z.object({
    draftId: DraftIdSchema,
    locale: z.enum(Locale).describe("Locale to edit."),
    edits: z
      .array(
        z.object({
          oldString: z
            .string()
            .min(1)
            .describe("Exact existing text to replace."),
          newString: z
            .string()
            .describe("Replacement text. Pass an empty string to delete."),
          replaceAll: z
            .boolean()
            .meta({
              description:
                "Replace every occurrence instead of failing on ambiguity.",
              default: false,
            })
            .optional(),
        })
      )
      .min(1)
      .max(50)
      .describe("Applied in this order."),
  }),
  executionMode: "sequential",
} satisfies ToolSpec;

export const editDraftContentTool = defineTool(
  editDraftContentSpec,
  (context: WritingToolContext) => async (params) => {
    const { draftId, locale } = params;
    // Matched under the draft lock against whatever body is current, so an operator save in
    // between is edited rather than overwritten.
    const { draft, edits } = await context.draft.editContent(
      draftId,
      locale,
      params.edits
    );
    const replacements = sumBy(edits, (edit) => edit.replacements);
    const where = edits
      .map(
        (edit, index) =>
          `Edit ${index + 1} — line ${edit.line}, ${edit.replacements} replacement(s)${MATCH_NOTE[edit.match]}:\n${edit.context}`
      )
      .join("\n\n");
    // The edit has landed; a body now in the wrong language is reported, and blocks the commit.
    const warning =
      languageMismatch(locale, draft.translations[locale]?.content ?? "") ??
      null;
    return {
      text:
        `Applied ${replacements} replacement(s) across ${edits.length} edit(s) to draft ${draftId} (${locale}, revision ${draft.revision}).` +
        `${warning ? `\n\nWarning: ${warning}` : ""}\n\n${where}`,
      details: {
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
          match: edits[index]?.match ?? MatchMode.Exact,
          line: edits[index]?.line ?? null,
        })),
      },
    };
  }
);

const ATX_HEADING = /^ {0,3}#{1,6}[ \t]/;

export const replaceSectionSpec = {
  name: ToolName.ReplaceSection,
  description:
    "Replace one section of a locale's MDX body: the heading line through the last line before " +
    "the next heading of the same or a shallower level, subsections included. `heading` is a " +
    "path from `read_draft`'s outline. `content` is the whole new section starting with its " +
    "heading line, so the heading itself may change; an empty string deletes the section. Use " +
    "it when most of a section changes; `edit_draft_content` is for smaller edits. The result " +
    "shows the numbered lines where it landed, so no read-back is needed.",
  parameters: z.object({
    draftId: DraftIdSchema,
    locale: z.enum(Locale).describe("Locale to edit."),
    heading: HeadingSchema,
    content: z
      .string()
      .describe(
        "The complete new section, beginning with its `#` heading line. Empty deletes the section."
      ),
  }),
  executionMode: "sequential",
} satisfies ToolSpec;

export const replaceSectionTool = defineTool(
  replaceSectionSpec,
  (context: WritingToolContext) => async (params) => {
    const { draftId, locale, heading, content } = params;
    const deleted = content.trim().length === 0;
    if (!deleted && !ATX_HEADING.test(content.trimStart())) {
      throw new Error(
        "`content` must start with the section's heading line (`## …`), or be empty to delete the section."
      );
    }

    const body = (await context.draft.get(draftId)).translations[locale]
      ?.content;
    if (body === undefined || body === null) {
      throw new Error(noBodyMessage(locale));
    }
    const section = sectionAt(
      await extractSections(body),
      heading,
      "Use edit_draft_content with enough surrounding text instead."
    );
    const lastLine =
      section.line +
      body.slice(section.start, section.end).split("\n").length -
      1;
    // Deleting takes the blank lines before the section with it, so the neighbours close up.
    let start = section.start;
    while (deleted && start > 0 && body[start - 1] === "\n") start -= 1;
    let end = section.end;
    while (deleted && start === 0 && body[end] === "\n") end += 1;
    const oldString = body.slice(start, end);

    // Matched under the draft lock; an operator edit to the section in between misses and the
    // error says to read again.
    const { draft, edits } = await context.draft.editContent(draftId, locale, [
      { oldString, newString: deleted ? "" : content },
    ]);
    const landed = edits[0];
    const warning =
      languageMismatch(locale, draft.translations[locale]?.content ?? "") ??
      null;
    return {
      text:
        `${deleted ? "Deleted" : "Replaced"} section "${section.path}" (was lines ${section.line}-${lastLine}) in draft ${draftId} (${locale}, revision ${draft.revision}).` +
        `${warning ? `\n\nWarning: ${warning}` : ""}\n\n${landed?.context ?? ""}`,
      details: {
        draftId,
        locale,
        heading: section.path,
        deleted,
        revision: draft.revision,
        warning,
        edits: [
          {
            oldString,
            newString: deleted ? "" : content,
            replacements: landed?.replacements ?? 0,
            match: landed?.match ?? MatchMode.Exact,
            line: landed?.line ?? null,
          },
        ],
      },
    };
  }
);
