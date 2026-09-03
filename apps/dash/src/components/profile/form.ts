import * as z from "zod";

import { Locale, ProfileEntryKind } from "@chia/db/types";
import {
  aboutDataSchema,
  educationDataSchema,
  experienceDataSchema,
  projectDataSchema,
} from "@chia/db/validator/profile";
import type { ProfileEntryContentInput } from "@chia/db/validator/profile";

import type { RouterInputs, RouterOutputs } from "@/libs/orpc/types";

/**
 * Every kind edits the same flat text fields. Each kind's branch keeps what it stores and
 * pipes it through the database data schema, so the form has no rules of its own and its
 * output is already the write payload.
 */

export type ProfileEntryView =
  RouterOutputs["profile"]["list"]["items"][number];
export type ProfileEntryWrite = RouterInputs["profile"]["create"];

const SORT_ORDER_LIMIT = 10_000;

export const LOCALES: readonly Locale[] = [Locale.zhTW, Locale.En];

const translationFieldsSchema = z.object({
  title: z.string(),
  summary: z.string(),
  content: z.string(),
});

const dataFieldsSchema = z.object({
  organization: z.string(),
  url: z.string(),
  location: z.string(),
  repository: z.string(),
  image: z.string(),
  /** `YYYY-MM-DD`, or empty. */
  startDate: z.string(),
  endDate: z.string(),
  /** Comma- or newline-separated. */
  stack: z.string(),
  translations: z.object({
    [Locale.zhTW]: translationFieldsSchema,
    [Locale.En]: translationFieldsSchema,
  }),
});

type DataFields = z.infer<typeof dataFieldsSchema>;
type TranslationFields = z.infer<typeof translationFieldsSchema>;

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
const translationOf = (translation: TranslationFields) =>
  blankToUndefined(translation.title) === undefined
    ? undefined
    : {
        title: translation.title,
        summary: blankToUndefined(translation.summary),
        content: blankToUndefined(translation.content),
      };

const translationsOf = (translations: DataFields["translations"]) => ({
  [Locale.zhTW]: translationOf(translations[Locale.zhTW]),
  [Locale.En]: translationOf(translations[Locale.En]),
});

const entryFields = {
  published: z.boolean(),
  sortOrder: z.number().int().min(-SORT_ORDER_LIMIT).max(SORT_ORDER_LIMIT),
};

export const profileFormSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal(ProfileEntryKind.About),
    ...entryFields,
    data: dataFieldsSchema
      .transform((data): z.input<typeof aboutDataSchema> => ({
        translations: translationsOf(data.translations),
      }))
      .pipe(aboutDataSchema),
  }),
  z.object({
    kind: z.literal(ProfileEntryKind.Experience),
    ...entryFields,
    data: dataFieldsSchema
      .transform((data): z.input<typeof experienceDataSchema> => ({
        organization: data.organization,
        url: blankToUndefined(data.url),
        location: blankToUndefined(data.location),
        startDate: data.startDate,
        endDate: blankToUndefined(data.endDate),
        stack: stackOf(data.stack),
        translations: translationsOf(data.translations),
      }))
      .pipe(experienceDataSchema),
  }),
  z.object({
    kind: z.literal(ProfileEntryKind.Education),
    ...entryFields,
    data: dataFieldsSchema
      .transform((data): z.input<typeof educationDataSchema> => ({
        organization: data.organization,
        url: blankToUndefined(data.url),
        startDate: data.startDate,
        endDate: blankToUndefined(data.endDate),
        translations: translationsOf(data.translations),
      }))
      .pipe(educationDataSchema),
  }),
  z.object({
    kind: z.literal(ProfileEntryKind.Project),
    ...entryFields,
    data: dataFieldsSchema
      .transform((data): z.input<typeof projectDataSchema> => ({
        url: blankToUndefined(data.url),
        repository: blankToUndefined(data.repository),
        image: blankToUndefined(data.image),
        startDate: blankToUndefined(data.startDate),
        endDate: blankToUndefined(data.endDate),
        stack: stackOf(data.stack),
        translations: translationsOf(data.translations),
      }))
      .pipe(projectDataSchema),
  }),
]);

export type ProfileFormInput = z.input<typeof profileFormSchema>;
export type ProfileFormOutput = z.output<typeof profileFormSchema>;

const emptyTranslation = (): TranslationFields => ({
  title: "",
  summary: "",
  content: "",
});

const emptyData = (): DataFields => ({
  organization: "",
  url: "",
  location: "",
  repository: "",
  image: "",
  startDate: "",
  endDate: "",
  stack: "",
  translations: {
    [Locale.zhTW]: emptyTranslation(),
    [Locale.En]: emptyTranslation(),
  },
});

export const emptyFormValues = (kind: ProfileEntryKind): ProfileFormInput => ({
  kind,
  published: false,
  sortOrder: 0,
  data: emptyData(),
});

const translationFieldsOf = (
  translation: { title: string; summary?: string; content?: string } | undefined
): TranslationFields => ({
  title: translation?.title ?? "",
  summary: translation?.summary ?? "",
  content: translation?.content ?? "",
});

export const formValuesOf = (entry: ProfileEntryView): ProfileFormInput => {
  const base = {
    published: entry.published,
    sortOrder: entry.sortOrder,
  };
  const data: DataFields = {
    ...emptyData(),
    translations: {
      [Locale.zhTW]: translationFieldsOf(entry.data.translations[Locale.zhTW]),
      [Locale.En]: translationFieldsOf(entry.data.translations[Locale.En]),
    },
  };
  switch (entry.kind) {
    case ProfileEntryKind.About:
      return { ...base, kind: entry.kind, data };
    case ProfileEntryKind.Experience:
      return {
        ...base,
        kind: entry.kind,
        data: {
          ...data,
          organization: entry.data.organization,
          url: entry.data.url ?? "",
          location: entry.data.location ?? "",
          startDate: entry.data.startDate,
          endDate: entry.data.endDate ?? "",
          stack: entry.data.stack.join(", "),
        },
      };
    case ProfileEntryKind.Education:
      return {
        ...base,
        kind: entry.kind,
        data: {
          ...data,
          organization: entry.data.organization,
          url: entry.data.url ?? "",
          startDate: entry.data.startDate,
          endDate: entry.data.endDate ?? "",
        },
      };
    case ProfileEntryKind.Project:
      return {
        ...base,
        kind: entry.kind,
        data: {
          ...data,
          url: entry.data.url ?? "",
          repository: entry.data.repository ?? "",
          image: entry.data.image ?? "",
          startDate: entry.data.startDate ?? "",
          endDate: entry.data.endDate ?? "",
          stack: entry.data.stack.join(", "),
        },
      };
  }
};

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
