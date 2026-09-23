import * as z from "zod";

import { Locale } from "../../types.ts";

export const TAG_SLUG_MAX_CHARS = 64;
export const TAG_NAME_MAX_CHARS = 64;
export const TAG_DESCRIPTION_MAX_CHARS = 500;
/** Tags on one post. */
export const FEED_TAGS_MAX = 20;

/** Lowercase ASCII words joined by single hyphens; the slug is a URL segment on the site. */
export const tagSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(TAG_SLUG_MAX_CHARS)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Slug must be lowercase ASCII words joined by single hyphens",
  });

const tagTranslationSchema = z.object({
  name: z.string().trim().min(1).max(TAG_NAME_MAX_CHARS),
  description: z
    .string()
    .trim()
    .max(TAG_DESCRIPTION_MAX_CHARS)
    .nullish()
    .transform((value) => (value ? value : null)),
});

/**
 * Both locales carry a name: chunk metadata joins tag names by the page's locale, so a tag
 * without one would be missing from that page's index.
 */
export const tagTranslationsSchema = z.object({
  [Locale.zhTW]: tagTranslationSchema,
  [Locale.En]: tagTranslationSchema,
});

export const tagWriteSchema = z.object({
  slug: tagSlugSchema,
  translations: tagTranslationsSchema,
});

export type TagTranslationWrite = z.output<typeof tagTranslationSchema>;
export type TagTranslationsWrite = z.output<typeof tagTranslationsSchema>;
export type TagWrite = z.output<typeof tagWriteSchema>;
export type TagWriteInput = z.input<typeof tagWriteSchema>;
