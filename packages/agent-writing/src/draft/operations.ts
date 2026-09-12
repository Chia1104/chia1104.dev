import type { Locale } from "@chia/db/types";
import { mergeDefined, omitUndefined } from "@chia/utils/object";
import { excerptAround } from "@chia/utils/text";
import type { AppliedEdit, ExactReplaceFailure } from "@chia/utils/text";

import type {
  DraftAppliedEdit,
  DraftFeedMeta,
  DraftTranslation,
  DraftWrite,
  FeedDraft,
  FeedDraftSummary,
} from "../types.ts";

export const emptyDraft = (overrides: Partial<FeedDraft> = {}): FeedDraft => ({
  id: 0,
  feedId: null,
  revision: 1,
  slug: null,
  type: "post",
  defaultLocale: "zh-TW",
  mainImage: null,
  translations: {},
  ...overrides,
});

export const patchFeedMeta = (
  draft: FeedDraft,
  patch: DraftFeedMeta
): FeedDraft => ({ ...draft, ...omitUndefined(patch) });

export const patchTranslation = (
  draft: FeedDraft,
  locale: Locale,
  patch: DraftTranslation
): FeedDraft => ({
  ...draft,
  translations: {
    ...draft.translations,
    [locale]: mergeDefined(draft.translations[locale] ?? {}, patch),
  },
});

/** What a summary needs from a draft; a full draft or a listed one both fit. */
type DraftSummarySource = Pick<
  FeedDraft,
  "id" | "feedId" | "revision" | "slug" | "type" | "defaultLocale"
> & {
  translations: Partial<Record<Locale, { title?: string | null }>>;
};

/** The default locale's title, else the first locale that has one. */
export const draftTitle = (
  draft: Pick<DraftSummarySource, "defaultLocale" | "translations">
): string | null => {
  const preferred = draft.translations[draft.defaultLocale]?.title;
  if (preferred) return preferred;
  for (const translation of Object.values(draft.translations)) {
    if (translation.title) return translation.title;
  }
  return null;
};

export const draftSummary = (
  draft: DraftSummarySource,
  updatedAt: Date
): FeedDraftSummary => ({
  id: draft.id,
  feedId: draft.feedId,
  revision: draft.revision,
  slug: draft.slug,
  type: draft.type,
  defaultLocale: draft.defaultLocale,
  title: draftTitle(draft),
  // SAFETY: FeedDraft.translations is keyed exclusively by Locale.
  locales: Object.keys(draft.translations) as Locale[],
  updatedAt: updatedAt.toISOString(),
});

export class DraftNotFoundError extends Error {
  constructor(readonly draftId: number) {
    super(
      `Draft ${draftId} does not exist or was discarded. Call list_drafts to see what is open.`
    );
    this.name = "DraftNotFoundError";
  }
}

export class DraftConflictError extends Error {
  constructor(
    readonly expectedRevision: number,
    readonly currentRevision: number
  ) {
    super(
      `The draft is at revision ${currentRevision}, not ${expectedRevision}: someone else changed it. Read it again before writing.`
    );
    this.name = "DraftConflictError";
  }
}

export const noBodyMessage = (locale: Locale) =>
  `No draft body for locale "${locale}" yet. Write one with write_draft first.`;

/** Lines around each landed edit, for a result the model can trust without reading again. */
export const describeEdits = (
  content: string,
  edits: readonly AppliedEdit[]
): DraftAppliedEdit[] =>
  edits.map((edit) => {
    const { line, text } = excerptAround(content, edit.offsets[0] ?? 0, 2);
    return { replacements: edit.replacements, line, context: text };
  });

/** Applies a write to an in-memory draft: meta first, then every locale, as one step. */
export const applyWrite = (draft: FeedDraft, input: DraftWrite): FeedDraft => {
  let next = input.meta ? patchFeedMeta(draft, input.meta) : draft;
  for (const [locale, patch] of Object.entries(input.translations ?? {})) {
    if (!patch) continue;
    // SAFETY: DraftWrite.translations is keyed by Locale.
    next = patchTranslation(next, locale as Locale, patch);
  }
  return next;
};

export class EditNotAppliedError extends Error {
  constructor(
    message: string,
    readonly reason: ExactReplaceFailure | "no_body"
  ) {
    super(message);
    this.name = "EditNotAppliedError";
  }
}
