import type { FieldErrors, Resolver } from "react-hook-form";

import { Locale, ProfileEntryKind } from "@chia/db/types";
import { profileEntryContentSchema } from "@chia/db/validator/profile";
import type { ProfileEntryContentInput } from "@chia/db/validator/profile";

import type { RouterInputs, RouterOutputs } from "@/libs/orpc/types";

/**
 * The form is one flat shape for every kind; `toContent` keeps the fields the kind stores
 * and `profileEntryContentSchema` is the only validation, so the form cannot drift from
 * what the API accepts.
 */

export type ProfileEntryView =
  RouterOutputs["profile"]["list"]["items"][number];
export type ProfileEntryWrite = RouterInputs["profile"]["create"];

export interface TranslationFormValues {
  title: string;
  summary: string;
  content: string;
}

export interface ProfileFormValues {
  published: boolean;
  sortOrder: number;
  organization: string;
  url: string;
  location: string;
  repository: string;
  image: string;
  startDate: string;
  endDate: string;
  /** Comma- or newline-separated. */
  stack: string;
  translations: Record<Locale, TranslationFormValues>;
}

export const LOCALES: readonly Locale[] = [Locale.zhTW, Locale.En];

const translationFormOf = (
  translation: { title: string; summary?: string; content?: string } | undefined
): TranslationFormValues => ({
  title: translation?.title ?? "",
  summary: translation?.summary ?? "",
  content: translation?.content ?? "",
});

export const emptyFormValues = (): ProfileFormValues => ({
  published: false,
  sortOrder: 0,
  organization: "",
  url: "",
  location: "",
  repository: "",
  image: "",
  startDate: "",
  endDate: "",
  stack: "",
  translations: {
    [Locale.zhTW]: translationFormOf(undefined),
    [Locale.En]: translationFormOf(undefined),
  },
});

export const formValuesOf = (entry: ProfileEntryView): ProfileFormValues => {
  const base: ProfileFormValues = {
    ...emptyFormValues(),
    published: entry.published,
    sortOrder: entry.sortOrder,
    translations: {
      [Locale.zhTW]: translationFormOf(entry.data.translations[Locale.zhTW]),
      [Locale.En]: translationFormOf(entry.data.translations[Locale.En]),
    },
  };
  switch (entry.kind) {
    case ProfileEntryKind.About:
      return base;
    case ProfileEntryKind.Experience:
      return {
        ...base,
        organization: entry.data.organization,
        url: entry.data.url ?? "",
        location: entry.data.location ?? "",
        startDate: entry.data.startDate,
        endDate: entry.data.endDate ?? "",
        stack: entry.data.stack.join(", "),
      };
    case ProfileEntryKind.Education:
      return {
        ...base,
        organization: entry.data.organization,
        url: entry.data.url ?? "",
        startDate: entry.data.startDate,
        endDate: entry.data.endDate ?? "",
      };
    case ProfileEntryKind.Project:
      return {
        ...base,
        url: entry.data.url ?? "",
        repository: entry.data.repository ?? "",
        image: entry.data.image ?? "",
        startDate: entry.data.startDate ?? "",
        endDate: entry.data.endDate ?? "",
        stack: entry.data.stack.join(", "),
      };
  }
};

const blankToUndefined = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const stackOf = (value: string): string[] =>
  value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item !== "");

/** A locale without a title is absent, not an empty translation. */
const translationInputOf = (translation: TranslationFormValues) =>
  blankToUndefined(translation.title) === undefined
    ? undefined
    : {
        title: translation.title,
        summary: blankToUndefined(translation.summary),
        content: blankToUndefined(translation.content),
      };

export const toContent = (
  kind: ProfileEntryKind,
  values: ProfileFormValues
): ProfileEntryContentInput => {
  const translations = {
    [Locale.zhTW]: translationInputOf(values.translations[Locale.zhTW]),
    [Locale.En]: translationInputOf(values.translations[Locale.En]),
  };
  switch (kind) {
    case ProfileEntryKind.About:
      return { kind, data: { translations } };
    case ProfileEntryKind.Experience:
      return {
        kind,
        data: {
          organization: values.organization,
          url: blankToUndefined(values.url),
          location: blankToUndefined(values.location),
          startDate: values.startDate,
          endDate: blankToUndefined(values.endDate),
          stack: stackOf(values.stack),
          translations,
        },
      };
    case ProfileEntryKind.Education:
      return {
        kind,
        data: {
          organization: values.organization,
          url: blankToUndefined(values.url),
          startDate: values.startDate,
          endDate: blankToUndefined(values.endDate),
          translations,
        },
      };
    case ProfileEntryKind.Project:
      return {
        kind,
        data: {
          url: blankToUndefined(values.url),
          repository: blankToUndefined(values.repository),
          image: blankToUndefined(values.image),
          startDate: blankToUndefined(values.startDate),
          endDate: blankToUndefined(values.endDate),
          stack: stackOf(values.stack),
          translations,
        },
      };
  }
};

export const toWrite = (
  kind: ProfileEntryKind,
  values: ProfileFormValues
): ProfileEntryWrite => ({
  published: values.published,
  sortOrder: values.sortOrder,
  ...toContent(kind, values),
});

/** Re-pairs `kind` with `data` so an existing row can be sent back as a write. */
export const contentOf = (
  entry: ProfileEntryView
): ProfileEntryContentInput => {
  switch (entry.kind) {
    case ProfileEntryKind.About:
      return { kind: entry.kind, data: entry.data };
    case ProfileEntryKind.Experience:
      return { kind: entry.kind, data: entry.data };
    case ProfileEntryKind.Education:
      return { kind: entry.kind, data: entry.data };
    case ProfileEntryKind.Project:
      return { kind: entry.kind, data: entry.data };
  }
};

type ScalarField = Exclude<
  keyof ProfileFormValues,
  "published" | "sortOrder" | "translations"
>;

const SCALAR_FIELDS: ReadonlySet<PropertyKey> = new Set<ScalarField>([
  "organization",
  "url",
  "location",
  "repository",
  "image",
  "startDate",
  "endDate",
  "stack",
]);

const isScalarField = (value: PropertyKey | undefined): value is ScalarField =>
  value !== undefined && SCALAR_FIELDS.has(value);

const isLocale = (value: PropertyKey | undefined): value is Locale =>
  value === Locale.zhTW || value === Locale.En;

const isTranslationField = (
  value: PropertyKey | undefined
): value is keyof TranslationFormValues =>
  value === "title" || value === "summary" || value === "content";

/**
 * Validates through the content schema and maps its issues back onto form fields. An issue
 * with no field of its own, such as "at least one locale", lands on `translations`.
 */
export const profileFormResolver =
  (kind: ProfileEntryKind): Resolver<ProfileFormValues> =>
  (values) => {
    const parsed = profileEntryContentSchema.safeParse(toContent(kind, values));
    if (parsed.success) {
      return { values, errors: {} };
    }

    const errors: FieldErrors<ProfileFormValues> = {};
    const unmapped: string[] = [];
    for (const issue of parsed.error.issues) {
      const [head, second, third] = issue.path.filter(
        (segment) => segment !== "data"
      );
      const error = { type: "validation", message: issue.message };
      if (
        head === "translations" &&
        isLocale(second) &&
        isTranslationField(third)
      ) {
        const translations = (errors.translations ??= {});
        const locale = (translations[second] ??= {});
        locale[third] = error;
      } else if (isScalarField(head)) {
        errors[head] = error;
      } else {
        unmapped.push(issue.message);
      }
    }
    if (unmapped.length > 0) {
      errors.translations = {
        ...errors.translations,
        type: "validation",
        message: unmapped.join(" "),
      };
    }
    return { values: {}, errors };
  };
