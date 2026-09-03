import * as z from "zod";

import { Locale, ProfileEntryKind } from "../../types.ts";

/**
 * Shape of `profile_entry.data` per kind. This is the only schema the stored JSON has,
 * so contract inputs, stored rows and every reader must parse through it.
 */

export const PROFILE_TITLE_MAX_CHARS = 200;
export const PROFILE_SUMMARY_MAX_CHARS = 1_000;
/** Markdown body; a resume item is bullets, not an essay. */
export const PROFILE_CONTENT_MAX_CHARS = 16_000;
/** Background the agent reads and the site never shows: what a company does, why a project mattered. */
export const PROFILE_AGENT_NOTES_MAX_CHARS = 4_000;
const NAME_MAX_CHARS = 120;
const STACK_ITEM_MAX_CHARS = 40;
const STACK_MAX_ITEMS = 40;

/** `YYYY-MM-DD`; the string sorts as a date, and readers format it to the precision they show. */
export const isoDateSchema = z.iso.date();

const translationSchema = z.object({
  title: z.string().trim().min(1).max(PROFILE_TITLE_MAX_CHARS),
  summary: z.string().trim().max(PROFILE_SUMMARY_MAX_CHARS).optional(),
  /** Markdown. */
  content: z.string().trim().max(PROFILE_CONTENT_MAX_CHARS).optional(),
});

const translationsSchema = z
  .object({
    [Locale.zhTW]: translationSchema.optional(),
    [Locale.En]: translationSchema.optional(),
  })
  .refine((value) => Object.values(value).some(Boolean), {
    message: "At least one locale is required",
  });

const stackSchema = z
  .array(z.string().trim().min(1).max(STACK_ITEM_MAX_CHARS))
  .max(STACK_MAX_ITEMS)
  .default([]);

/** Absent `endDate` means ongoing. */
const tenure = {
  startDate: isoDateSchema,
  endDate: isoDateSchema.optional(),
};

const endsAfterStart = (value: { startDate?: string; endDate?: string }) =>
  value.startDate === undefined ||
  value.endDate === undefined ||
  value.endDate >= value.startDate;

const ENDS_AFTER_START = {
  message: "endDate must not precede startDate",
  path: ["endDate"],
};

/** Not localized: the agent reads one locale and translates for the visitor. */
const agentNotes = {
  agentNotes: z.string().trim().max(PROFILE_AGENT_NOTES_MAX_CHARS).optional(),
};

export const aboutDataSchema = z.object({
  translations: translationsSchema,
  ...agentNotes,
});

export const experienceDataSchema = z
  .object({
    organization: z.string().trim().min(1).max(NAME_MAX_CHARS),
    url: z.url().optional(),
    location: z.string().trim().max(NAME_MAX_CHARS).optional(),
    ...tenure,
    stack: stackSchema,
    translations: translationsSchema,
    ...agentNotes,
  })
  .refine(endsAfterStart, ENDS_AFTER_START);

export const educationDataSchema = z
  .object({
    organization: z.string().trim().min(1).max(NAME_MAX_CHARS),
    url: z.url().optional(),
    ...tenure,
    translations: translationsSchema,
    ...agentNotes,
  })
  .refine(endsAfterStart, ENDS_AFTER_START);

export const projectDataSchema = z
  .object({
    url: z.url().optional(),
    repository: z.url().optional(),
    image: z.url().optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    stack: stackSchema,
    translations: translationsSchema,
    ...agentNotes,
  })
  .refine(endsAfterStart, ENDS_AFTER_START);

/** `kind` with the `data` that kind stores; the pair is what a row means. */
export const profileEntryContentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal(ProfileEntryKind.About),
    data: aboutDataSchema,
  }),
  z.object({
    kind: z.literal(ProfileEntryKind.Experience),
    data: experienceDataSchema,
  }),
  z.object({
    kind: z.literal(ProfileEntryKind.Education),
    data: educationDataSchema,
  }),
  z.object({
    kind: z.literal(ProfileEntryKind.Project),
    data: projectDataSchema,
  }),
]);

export type ProfileEntryContent = z.infer<typeof profileEntryContentSchema>;
export type ProfileEntryContentInput = z.input<
  typeof profileEntryContentSchema
>;
export type ProfileEntryData = ProfileEntryContent["data"];
export type ProfileEntryTranslation = z.infer<typeof translationSchema>;
export type ProfileEntryTranslations = z.infer<typeof translationsSchema>;
