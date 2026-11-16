import * as z from "zod";

import { Locale } from "../../types.ts";

export const MEDIA_TITLE_MAX_CHARS = 300;
/** A short take shown beside the cover, not a review. */
export const MEDIA_COMMENT_MAX_CHARS = 1_000;
export const MEDIA_RATING_MAX = 10;

const translationSchema = z.object({
  title: z.string().trim().min(1).max(MEDIA_TITLE_MAX_CHARS),
  comment: z.string().trim().max(MEDIA_COMMENT_MAX_CHARS).optional(),
});

/** Shape of `media_entry.translations`; a reader falls back to the other locale. */
export const mediaTranslationsSchema = z
  .object({
    [Locale.ZhTW]: translationSchema.optional(),
    [Locale.En]: translationSchema.optional(),
  })
  .refine((value) => Object.values(value).some(Boolean), {
    message: "At least one locale is required",
  });

export const MEDIA_ACHIEVEMENT_NAME_MAX_CHARS = 200;
export const MEDIA_ACHIEVEMENT_DESCRIPTION_MAX_CHARS = 1_000;

const achievementTranslationSchema = z.object({
  name: z.string().trim().min(1).max(MEDIA_ACHIEVEMENT_NAME_MAX_CHARS),
  description: z
    .string()
    .trim()
    .max(MEDIA_ACHIEVEMENT_DESCRIPTION_MAX_CHARS)
    .optional(),
});

/** Shape of `media_achievement.translations`; a reader falls back to the other locale. */
export const mediaAchievementTranslationsSchema = z
  .object({
    [Locale.ZhTW]: achievementTranslationSchema.optional(),
    [Locale.En]: achievementTranslationSchema.optional(),
  })
  .refine((value) => Object.values(value).some(Boolean), {
    message: "At least one locale is required",
  });

export const mediaRatingSchema = z.number().int().min(1).max(MEDIA_RATING_MAX);

/** `#rrggbb`, lower or upper case. */
export const mediaColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);

/** `YYYY-MM-DD`: a calendar day, not an instant. */
export const mediaDateSchema = z.iso.date();

export type MediaTranslation = z.infer<typeof translationSchema>;
export type MediaTranslations = z.infer<typeof mediaTranslationsSchema>;
export type MediaAchievementTranslation = z.infer<
  typeof achievementTranslationSchema
>;
export type MediaAchievementTranslations = z.infer<
  typeof mediaAchievementTranslationsSchema
>;
