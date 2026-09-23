import { hashFeedDraftSnapshot } from "@chia/db/repos/drafts/hash";
import type { FeedDraftFields } from "@chia/db/repos/drafts/patch";
import type { FeedDraftSnapshot } from "@chia/db/schema";
import type { Locale } from "@chia/db/types";
import { mergeDefined, omitUndefined } from "@chia/utils/object";
import { applyEdits, excerptAround } from "@chia/utils/text";
import type { AppliedEdit, ExactReplaceFailure } from "@chia/utils/text";

import { withoutFencedCode } from "../markdown/fences.ts";
import type {
  DraftAppliedEdit,
  DraftContentEdit,
  DraftFeedMeta,
  DraftTranslation,
  DraftWrite,
  FeedDraft,
  FeedDraftSummary,
} from "../types.ts";

/** The draft as the shared row stores it: every field present, `null` where empty. */
export const snapshotOfDraft = (
  draft: Omit<FeedDraft, "contentHash">
): FeedDraftSnapshot => {
  const translations: FeedDraftSnapshot["translations"] = {};
  for (const [locale, translation] of Object.entries(draft.translations)) {
    // SAFETY: draft translations are keyed by Locale.
    translations[locale as Locale] = {
      title: translation.title ?? null,
      excerpt: translation.excerpt ?? null,
      description: translation.description ?? null,
      content: translation.content ?? null,
    };
  }
  return {
    slug: draft.slug,
    type: draft.type,
    defaultLocale: draft.defaultLocale,
    mainImage: draft.mainImage,
    translations,
  };
};

/** The hash the shared draft row would carry for this content. */
export const hashDraft = (draft: Omit<FeedDraft, "contentHash">): string =>
  hashFeedDraftSnapshot(snapshotOfDraft(draft));

/** A write in the repository's terms, without the fields it leaves alone. */
export const toDraftFields = (input: DraftWrite): FeedDraftFields => {
  const translations: NonNullable<FeedDraftFields["translations"]> = {};
  for (const [locale, patch] of Object.entries(input.translations ?? {})) {
    if (!patch) continue;
    // SAFETY: DraftWrite.translations is keyed by Locale.
    translations[locale as Locale] = omitUndefined(patch);
  }
  return {
    meta: input.meta ? omitUndefined(input.meta) : undefined,
    translations,
  };
};

export const emptyDraft = (overrides: Partial<FeedDraft> = {}): FeedDraft => {
  const draft = {
    id: 0,
    feedId: null,
    revision: 1,
    slug: null,
    type: "post" as const,
    defaultLocale: "zh-TW" as const,
    mainImage: null,
    translations: {},
    ...overrides,
  };
  return { ...draft, contentHash: overrides.contentHash ?? hashDraft(draft) };
};

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
  constructor(readonly fields: readonly string[]) {
    super(
      `Someone else changed ${fields.join(", ")} since you last read the draft, so nothing was written. Read it again before writing ${fields.length === 1 ? "that field" : "those fields"}.`
    );
    this.name = "DraftConflictError";
  }
}

/**
 * What the model has seen of each draft, which is what its writes are checked against. A read
 * replaces the view and a write adds only what it wrote, so a change the model never saw
 * rejects the write that would bury it instead of being overwritten.
 */
export class ObservedDrafts {
  private readonly views = new Map<number, FeedDraft>();
  /**
   * Highest revision the model read in full, per draft; the host records them as seen when the
   * turn ends. A write does not count: its result may carry a change the model was not shown.
   */
  readonly revisions = new Map<number, number>();

  private note(draft: FeedDraft) {
    if (draft.revision > (this.revisions.get(draft.id) ?? 0)) {
      this.revisions.set(draft.id, draft.revision);
    }
  }

  has(draftId: number): boolean {
    return this.views.has(draftId);
  }

  read(draft: FeedDraft): FeedDraft {
    this.note(draft);
    this.views.set(draft.id, draft);
    return draft;
  }

  wrote(draft: FeedDraft, input: DraftWrite): FeedDraft {
    const view = this.views.get(draft.id);
    if (view) this.views.set(draft.id, applyWrite(view, input));
    return draft;
  }

  /** The model knows its own edits: they go onto the body it saw, when they fit it. */
  edited(
    draft: FeedDraft,
    locale: Locale,
    edits: readonly DraftContentEdit[]
  ): FeedDraft {
    const view = this.views.get(draft.id);
    const body = view?.translations[locale]?.content;
    if (!view || !body) return draft;
    const placed = applyEdits(body, edits);
    if (placed.ok) {
      this.views.set(
        draft.id,
        patchTranslation(view, locale, { content: placed.content })
      );
    }
    return draft;
  }

  /** What the view holds in the fields `input` writes; `null` for a draft never read. */
  baseOf(draftId: number, input: DraftWrite): DraftWrite | null {
    const view = this.views.get(draftId);
    if (!view) return null;
    const meta: Record<string, string | null> = {};
    for (const [field, value] of Object.entries(input.meta ?? {})) {
      if (value === undefined) continue;
      // SAFETY: `field` is a key of DraftFeedMeta, all of which FeedDraft carries.
      meta[field] = view[field as keyof DraftFeedMeta];
    }
    const translations: NonNullable<DraftWrite["translations"]> = {};
    for (const [locale, patch] of Object.entries(input.translations ?? {})) {
      // SAFETY: DraftWrite.translations is keyed by Locale.
      const held = view.translations[locale as Locale];
      const seen: Record<string, string | null> = {};
      for (const [field, value] of Object.entries(patch ?? {})) {
        if (value === undefined) continue;
        // SAFETY: `field` is a key of DraftTranslation.
        seen[field] = held?.[field as keyof DraftTranslation] ?? null;
      }
      if (Object.keys(seen).length > 0) {
        // SAFETY: as above.
        translations[locale as Locale] = seen;
      }
    }
    // SAFETY: every key of `meta` came from `input.meta`.
    return { meta: meta as DraftFeedMeta, translations };
  }
}

/**
 * Which language a locale's prose is written in, judged by the share of Han characters among
 * Han and Latin letters outside code. The zh-TW floor is low because a Latin letter is a
 * fraction of a word while a Han character is most of one: Chinese prose full of English
 * terms still clears it, and an English body under zh-TW does not.
 */
const PROSE_LANGUAGE = {
  en: { language: "English", hanShare: { max: 0.2 } },
  "zh-TW": { language: "Chinese", hanShare: { min: 0.05 } },
} as const satisfies Record<
  Locale,
  { language: string; hanShare: { max: number } | { min: number } }
>;

/** Below this many letters a body is too short to judge. */
const LANGUAGE_SAMPLE_MIN = 80;

const withoutCode = (body: string) =>
  withoutFencedCode(body).replace(/`[^`\n]*`/g, " ");

/** Why a body does not read as its locale's language, or undefined. */
export const languageMismatch = (
  locale: Locale,
  body: string
): string | undefined => {
  const prose = withoutCode(body);
  const han = prose.match(/\p{Script=Han}/gu)?.length ?? 0;
  const latin = prose.match(/\p{Script=Latin}/gu)?.length ?? 0;
  if (han + latin < LANGUAGE_SAMPLE_MIN) return undefined;

  const rule = PROSE_LANGUAGE[locale];
  const share = han / (han + latin);
  const wrong =
    "max" in rule.hanShare
      ? share > rule.hanShare.max
      : share < rule.hanShare.min;
  if (!wrong) return undefined;
  return (
    `The ${locale} body is ${Math.round(share * 100)}% Chinese characters outside code; ` +
    `the ${locale} locale takes ${rule.language} prose. Rewrite it in ${rule.language}, ` +
    `or leave the ${locale} locale out until it is.`
  );
};

export const noBodyMessage = (locale: Locale) =>
  `No draft body for locale "${locale}" yet. Write one with write_draft first.`;

/** Lines around each landed edit, for a result the model can trust without reading again. */
export const describeEdits = (
  content: string,
  edits: readonly AppliedEdit[]
): DraftAppliedEdit[] =>
  edits.map((edit) => {
    const { line, text } = excerptAround(content, edit.offsets[0] ?? 0, 2);
    return {
      replacements: edit.replacements,
      match: edit.match,
      line,
      context: text,
    };
  });

/** Applies a write to an in-memory draft: meta first, then every locale, as one step. */
export const applyWrite = (draft: FeedDraft, input: DraftWrite): FeedDraft => {
  let next = input.meta ? patchFeedMeta(draft, input.meta) : draft;
  for (const [locale, patch] of Object.entries(input.translations ?? {})) {
    // A patch with no defined field must not create the locale or bump the revision.
    if (!patch || Object.values(patch).every((value) => value === undefined)) {
      continue;
    }
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
