import { Locale } from "@chia/db/types";
import type { Locale as LocaleType } from "@chia/db/types";
import { applyEdits } from "@chia/utils/text";
import { toEdits } from "@chia/utils/text/diff";

import type { RouterInputs, RouterOutputs } from "@/libs/orpc/types";

import type { DraftFormValues } from "./draft-form-schema";

export type DraftView = RouterOutputs["feeds"]["draft:get"];
type PatchInput = RouterInputs["feeds"]["draft:patch"];
/** Field values only: what moved, or what those fields held before. */
export type DraftPatch = Pick<
  PatchInput,
  "slug" | "type" | "defaultLocale" | "mainImage" | "translations"
>;
export type DraftValues = Omit<DraftFormValues, "activeLocale">;
type TranslationValues = NonNullable<DraftValues["translations"][LocaleType]>;

const LOCALES = [Locale.ZhTW, Locale.En] as const;
const META_FIELDS = ["slug", "type", "defaultLocale", "mainImage"] as const;
const TRANSLATION_FIELDS = [
  "title",
  "excerpt",
  "description",
  "content",
] as const;
const emptyTranslation = (): TranslationValues => ({
  title: null,
  excerpt: null,
  description: null,
  content: null,
});

export const toValues = (draft: DraftView): DraftValues => ({
  slug: draft.slug,
  type: draft.type,
  defaultLocale: draft.defaultLocale,
  mainImage: draft.mainImage,
  translations: Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      { ...emptyTranslation(), ...draft.translations[locale] },
    ])
  ),
});

type FieldValue = string | null | undefined;

const same = (a: FieldValue, b: FieldValue) => (a ?? null) === (b ?? null);

/** Only what moved since `base`, so the revision trail records the fields actually touched. */
export const diffValues = (
  next: DraftValues,
  base: DraftValues
): DraftPatch | null => {
  const patch: DraftPatch = {};
  let changed = false;
  for (const field of META_FIELDS) {
    if (!same(next[field], base[field])) {
      Object.assign(patch, { [field]: next[field] });
      changed = true;
    }
  }
  const translations: NonNullable<PatchInput["translations"]> = {};
  for (const locale of LOCALES) {
    const current = next.translations[locale];
    const previous = base.translations[locale];
    if (!current) continue;
    const localePatch: Partial<TranslationValues> = {};
    let localeChanged = false;
    for (const field of TRANSLATION_FIELDS) {
      if (!same(current[field], previous?.[field])) {
        localePatch[field] = current[field];
        localeChanged = true;
      }
    }
    if (localeChanged) {
      translations[locale] = localePatch;
      changed = true;
    }
  }
  if (Object.keys(translations).length > 0) patch.translations = translations;
  return changed ? patch : null;
};

export const applyPatch = (
  base: DraftValues,
  patch: DraftPatch
): DraftValues => {
  const { translations, ...meta } = patch;
  const next: DraftValues = {
    ...base,
    ...meta,
    translations: { ...base.translations },
  };
  for (const locale of LOCALES) {
    const localePatch = translations?.[locale];
    if (!localePatch) continue;
    next.translations[locale] = {
      ...emptyTranslation(),
      ...base.translations[locale],
      ...localePatch,
    };
  }
  return next;
};

/** What `base` holds in the fields `patch` names. */
export const seenOf = (patch: DraftPatch, base: DraftValues): DraftPatch => {
  const seen: DraftPatch = {};
  for (const field of META_FIELDS) {
    if (field in patch) Object.assign(seen, { [field]: base[field] });
  }
  const translations: NonNullable<DraftPatch["translations"]> = {};
  for (const locale of LOCALES) {
    const localePatch = patch.translations?.[locale];
    if (!localePatch) continue;
    const held = { ...emptyTranslation(), ...base.translations[locale] };
    const localeSeen: Partial<TranslationValues> = {};
    for (const field of TRANSLATION_FIELDS) {
      if (field in localePatch) localeSeen[field] = held[field];
    }
    translations[locale] = localeSeen;
  }
  if (Object.keys(translations).length > 0) seen.translations = translations;
  return seen;
};

export type DraftWrite = Omit<PatchInput, "draftId" | "expectedRevision">;

/**
 * What takes the draft from `base` to `local`, guarded field by field: every value goes with the
 * one in `base` it replaces, and a body that already had text goes as edits placed against
 * whatever the server holds, so it lands beside a change someone else made elsewhere in it.
 */
export const toWrite = (
  local: DraftValues,
  base: DraftValues
): DraftWrite | null => {
  const patch = diffValues(local, base);
  if (!patch) return null;
  const seen = seenOf(patch, base);

  const values: NonNullable<DraftWrite["translations"]> = {};
  const seenValues: NonNullable<DraftWrite["translations"]> = {};
  const edits: NonNullable<DraftWrite["edits"]> = {};
  for (const locale of LOCALES) {
    const { content: after, ...fields } = patch.translations?.[locale] ?? {};
    const { content: before, ...seenFields } =
      seen.translations?.[locale] ?? {};
    if (after && before) {
      edits[locale] = toEdits(before, after);
    } else if (after !== undefined) {
      Object.assign(fields, { content: after });
      Object.assign(seenFields, { content: before ?? null });
    }
    if (Object.keys(fields).length > 0) {
      values[locale] = fields;
      seenValues[locale] = seenFields;
    }
  }

  const { translations: _values, ...meta } = patch;
  const { translations: _seen, ...seenMeta } = seen;
  const write: DraftWrite = { ...meta };
  const guard: NonNullable<DraftWrite["base"]> = { ...seenMeta };
  if (Object.keys(values).length > 0) {
    write.translations = values;
    guard.translations = seenValues;
  }
  if (Object.keys(edits).length > 0) write.edits = edits;
  if (Object.keys(guard).length > 0) write.base = guard;
  return write;
};

/** A field both sides changed to different values; the local value is the one kept. */
export interface DraftFieldConflict {
  locale?: LocaleType;
  field: string;
}

export interface RebasedDraftValues {
  values: DraftValues;
  /** Fields left at their local value because both sides changed them. */
  conflicts: DraftFieldConflict[];
}

/**
 * The local values carried onto a newer server state. `base` is what the local edits were made
 * against. A field the editor did not touch takes the server's value; one only the editor
 * touched keeps the local value; a body both touched is merged by placing the local changes
 * into the server's text. What cannot be reconciled stays local and is reported. `acknowledged`
 * marks `next` as the answer to writing `base` itself, where the server's value is that write
 * as stored and anything typed since simply wins.
 */
export const rebaseValues = ({
  base,
  local,
  next,
  acknowledged = false,
}: {
  base: DraftValues;
  local: DraftValues;
  next: DraftValues;
  acknowledged?: boolean;
}): RebasedDraftValues => {
  const conflicts: DraftFieldConflict[] = [];
  const settle = <TValue extends FieldValue>(
    field: DraftFieldConflict,
    mine: TValue,
    seen: TValue,
    theirs: TValue
  ): TValue => {
    if (same(mine, seen)) return theirs;
    if (same(theirs, seen) || same(theirs, mine) || acknowledged) return mine;
    conflicts.push(field);
    return mine;
  };

  const values: DraftValues = {
    ...local,
    slug: settle({ field: "slug" }, local.slug, base.slug, next.slug),
    type: settle({ field: "type" }, local.type, base.type, next.type),
    defaultLocale: settle(
      { field: "defaultLocale" },
      local.defaultLocale,
      base.defaultLocale,
      next.defaultLocale
    ),
    mainImage: settle(
      { field: "mainImage" },
      local.mainImage,
      base.mainImage,
      next.mainImage
    ),
    translations: {},
  };

  for (const locale of LOCALES) {
    const mine = { ...emptyTranslation(), ...local.translations[locale] };
    const seen = { ...emptyTranslation(), ...base.translations[locale] };
    const theirs = { ...emptyTranslation(), ...next.translations[locale] };
    const merged = { ...mine };
    for (const field of TRANSLATION_FIELDS) {
      if (field === "content") continue;
      merged[field] = settle(
        { locale, field },
        mine[field],
        seen[field],
        theirs[field]
      );
    }

    if (same(mine.content, seen.content)) {
      merged.content = theirs.content;
    } else if (
      !same(theirs.content, seen.content) &&
      !same(theirs.content, mine.content)
    ) {
      const placed =
        seen.content && mine.content && theirs.content
          ? applyEdits(theirs.content, toEdits(seen.content, mine.content), {
              exactOnly: true,
            })
          : null;
      if (placed?.ok) merged.content = placed.content;
      else conflicts.push({ locale, field: "content" });
    }
    values.translations[locale] = merged;
  }
  return { values, conflicts };
};
