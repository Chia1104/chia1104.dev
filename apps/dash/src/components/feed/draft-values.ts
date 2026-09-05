import { Locale } from "@chia/db/types";
import type { Locale as LocaleType } from "@chia/db/types";

import type { RouterInputs, RouterOutputs } from "@/libs/orpc/types";

import type { DraftFormValues } from "./draft-form-schema";

export type DraftView = RouterOutputs["feeds"]["draft:get"];
type PatchInput = RouterInputs["feeds"]["draft:patch"];
export type DraftValues = Omit<DraftFormValues, "activeLocale">;
type TranslationValues = NonNullable<DraftValues["translations"][LocaleType]>;

const LOCALES = [Locale.zhTW, Locale.En] as const;
const META_FIELDS = ["slug", "type", "defaultLocale", "mainImage"] as const;
const TRANSLATION_FIELDS = [
  "title",
  "excerpt",
  "description",
  "summary",
  "content",
] as const;
const emptyTranslation = (): TranslationValues => ({
  title: null,
  excerpt: null,
  description: null,
  summary: null,
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
): Omit<PatchInput, "draftId" | "expectedRevision"> | null => {
  const patch: Omit<PatchInput, "draftId" | "expectedRevision"> = {};
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
  patch: Omit<PatchInput, "draftId" | "expectedRevision">
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
