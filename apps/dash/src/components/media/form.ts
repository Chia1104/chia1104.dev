import * as z from "zod";

import { Locale, MediaKind, MediaStatus } from "@chia/db/types";
import {
  MEDIA_RATING_MAX,
  mediaTranslationsSchema,
} from "@chia/db/validator/media";
import type {
  MediaTranslation,
  MediaTranslations,
} from "@chia/db/validator/media";

import type { RouterInputs, RouterOutputs } from "@/libs/orpc/types";

export type MediaEntryView = RouterOutputs["media"]["list"]["items"][number];
export type MediaCandidate = RouterOutputs["media"]["search"]["items"][number];
export type MediaEntryUpdate = Omit<RouterInputs["media"]["update"], "id">;

export const LOCALES: readonly Locale[] = [Locale.ZhTW, Locale.En];

export const KINDS = [
  MediaKind.Movie,
  MediaKind.Series,
  MediaKind.Anime,
  MediaKind.Game,
] as const;

export const KIND_LABEL = {
  [MediaKind.Movie]: "Movies",
  [MediaKind.Series]: "Series",
  [MediaKind.Anime]: "Anime",
  [MediaKind.Game]: "Games",
} satisfies Record<MediaKind, string>;

/** A game is played, everything else is watched. */
export const STATUS_LABEL = {
  [MediaStatus.Planned]: "Planned",
  [MediaStatus.InProgress]: "In progress",
  [MediaStatus.Completed]: "Completed",
  [MediaStatus.Dropped]: "Dropped",
} satisfies Record<MediaStatus, string>;

export const STATUS_OPTIONS = Object.values(MediaStatus).map((status) => ({
  id: status,
  label: STATUS_LABEL[status],
}));

export const titleOf = (entry: MediaEntryView): string =>
  entry.translations[Locale.ZhTW]?.title ??
  entry.translations[Locale.En]?.title ??
  entry.originalTitle ??
  "(untitled)";

const translationFieldsSchema = z.object({
  title: z.string(),
  comment: z.string(),
});

type TranslationFields = z.infer<typeof translationFieldsSchema>;

const blankToNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

/** A locale without a title is left out; its comment has nothing to attach to. */
const translationOf = (
  fields: TranslationFields
): MediaTranslation | undefined => {
  const title = fields.title.trim();
  if (title === "") return undefined;
  const comment = fields.comment.trim();
  return comment === "" ? { title } : { title, comment };
};

const translationsOf = (
  fields: Record<Locale, TranslationFields>
): MediaTranslations => {
  const translations: MediaTranslations = {};
  for (const locale of LOCALES) {
    const translation = translationOf(fields[locale]);
    if (translation) translations[locale] = translation;
  }
  return translations;
};

/**
 * The form edits flat text fields and pipes them through the database translations schema, so
 * its output is already the update payload.
 */
export const mediaFormSchema = z
  .object({
    status: z.enum(MediaStatus),
    rating: z.number().int().min(1).max(MEDIA_RATING_MAX).nullable(),
    favorite: z.boolean(),
    /** `YYYY-MM-DD`, or empty. */
    startedOn: z.string(),
    finishedOn: z.string(),
    originalTitle: z.string(),
    releaseYear: z.number().int().nullable(),
    translations: z.object({
      [Locale.ZhTW]: translationFieldsSchema,
      [Locale.En]: translationFieldsSchema,
    }),
  })
  .transform((fields) => ({
    status: fields.status,
    rating: fields.rating,
    favorite: fields.favorite,
    startedOn: blankToNull(fields.startedOn),
    finishedOn: blankToNull(fields.finishedOn),
    originalTitle: blankToNull(fields.originalTitle),
    releaseYear: fields.releaseYear,
    translations: translationsOf(fields.translations),
  }))
  .pipe(
    z
      .object({
        status: z.enum(MediaStatus),
        rating: z.number().nullable(),
        favorite: z.boolean(),
        startedOn: z.string().nullable(),
        finishedOn: z.string().nullable(),
        originalTitle: z.string().nullable(),
        releaseYear: z.number().nullable(),
        translations: mediaTranslationsSchema,
      })
      .refine(
        (value) =>
          value.startedOn === null ||
          value.finishedOn === null ||
          value.finishedOn >= value.startedOn,
        { message: "Finished must not precede started", path: ["finishedOn"] }
      )
  ) satisfies z.ZodType<MediaEntryUpdate>;

export type MediaFormInput = z.input<typeof mediaFormSchema>;
export type MediaFormOutput = z.output<typeof mediaFormSchema>;

export const formValuesOf = (entry: MediaEntryView): MediaFormInput => ({
  status: entry.status,
  rating: entry.rating,
  favorite: entry.favorite,
  startedOn: entry.startedOn ?? "",
  finishedOn: entry.finishedOn ?? "",
  originalTitle: entry.originalTitle ?? "",
  releaseYear: entry.releaseYear,
  translations: {
    [Locale.ZhTW]: {
      title: entry.translations[Locale.ZhTW]?.title ?? "",
      comment: entry.translations[Locale.ZhTW]?.comment ?? "",
    },
    [Locale.En]: {
      title: entry.translations[Locale.En]?.title ?? "",
      comment: entry.translations[Locale.En]?.comment ?? "",
    },
  },
});
