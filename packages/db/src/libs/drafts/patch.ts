import { pick } from "es-toolkit";

import { applyEdits } from "@chia/utils/text";
import type { ContentEdit, ExactReplaceFailure } from "@chia/utils/text";

import type {
  FeedDraftSnapshot,
  FeedDraftTranslationSnapshot,
  FeedType,
} from "../../schemas/schema.ts";
import { Locale } from "../../types.ts";

/** What a draft write may change and what it is checked against; no database in here. */

/** `undefined` leaves a field alone; `null` clears it. */
export type FeedDraftTranslationPatch = Partial<FeedDraftTranslationSnapshot>;

export interface FeedDraftMetaPatch {
  slug?: string | null;
  type?: FeedType;
  defaultLocale?: Locale;
  mainImage?: string | null;
}

export const TRANSLATION_FIELDS = [
  "title",
  "excerpt",
  "description",
  "content",
] as const;

export const META_FIELDS = [
  "slug",
  "type",
  "defaultLocale",
  "mainImage",
] as const;

/** The names in `allowed` whose value in `patch` is not `undefined`. */
export const definedKeys = <TPatch extends object>(
  patch: TPatch,
  allowed: readonly (keyof TPatch & string)[]
): (keyof TPatch & string)[] =>
  allowed.filter((key) => patch[key] !== undefined);

export interface FeedDraftFields {
  meta?: FeedDraftMetaPatch;
  translations?: Partial<Record<Locale, FeedDraftTranslationPatch>>;
}

/** A change the draft could not take; `reason` is `changed` for a field that moved off its base. */
export interface FeedDraftRejectedChange {
  locale?: Locale;
  field: string;
  reason: "changed" | "no_body" | ExactReplaceFailure;
}

/** A patch with the guards it is checked against. */
export interface GuardedFeedDraftFields extends FeedDraftFields {
  /**
   * What the caller last saw of the fields it writes. A field holding that value is written, one
   * already holding the new value is left alone, and one holding anything else rejects the
   * whole write. A field without a base is written over whatever is current.
   */
  base?: FeedDraftFields;
  /**
   * Replacements in a locale's body, matched byte for byte against what it holds now, so they
   * land beside a change made elsewhere in it and are rejected by one made in the same place.
   */
  edits?: Partial<Record<Locale, readonly ContentEdit[]>>;
}

/**
 * The fields of `input` that would change `current`, with `edits` placed into their bodies, or
 * the changes `current` cannot take.
 */
export const settleFeedDraftPatch = (
  current: FeedDraftSnapshot,
  input: GuardedFeedDraftFields
):
  | { ok: true; fields: FeedDraftFields }
  | { ok: false; rejected: FeedDraftRejectedChange[] } => {
  const rejected: FeedDraftRejectedChange[] = [];
  const inputMeta = input.meta ?? {};
  const metaFields: (keyof FeedDraftMetaPatch)[] = [];
  for (const field of definedKeys(inputMeta, META_FIELDS)) {
    if (current[field] === inputMeta[field]) continue;
    const base = input.base?.meta?.[field];
    if (base !== undefined && base !== current[field]) {
      rejected.push({ field, reason: "changed" });
      continue;
    }
    metaFields.push(field);
  }

  const translations: NonNullable<FeedDraftFields["translations"]> = {};
  for (const locale of Object.values(Locale)) {
    const held = current.translations[locale];
    const patch = input.translations?.[locale] ?? {};
    const next: FeedDraftTranslationPatch = {};
    for (const field of definedKeys(patch, TRANSLATION_FIELDS)) {
      const value = patch[field] ?? null;
      if ((held?.[field] ?? null) === value) continue;
      const base = input.base?.translations?.[locale]?.[field];
      if (base !== undefined && base !== (held?.[field] ?? null)) {
        rejected.push({ locale, field, reason: "changed" });
        continue;
      }
      next[field] = value;
    }

    const edits = input.edits?.[locale];
    if (edits && edits.length > 0) {
      const body = held?.content ?? null;
      const placed =
        body === null ? null : applyEdits(body, edits, { exactOnly: true });
      if (!placed) {
        rejected.push({ locale, field: "content", reason: "no_body" });
      } else if (!placed.ok) {
        rejected.push({ locale, field: "content", reason: placed.reason });
      } else if (placed.content !== body) {
        next.content = placed.content;
      }
    }
    if (Object.keys(next).length > 0) translations[locale] = next;
  }

  if (rejected.length > 0) return { ok: false, rejected };
  return {
    ok: true,
    fields: { meta: pick(inputMeta, metaFields), translations },
  };
};
