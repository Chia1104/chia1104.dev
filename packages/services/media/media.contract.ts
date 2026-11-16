import { oc } from "@orpc/contract";
import * as z from "zod";

import { MediaKind, MediaSource, MediaStatus } from "@chia/db/types";
import {
  MEDIA_TITLE_MAX_CHARS,
  mediaAchievementTranslationsSchema,
  mediaColorSchema,
  mediaDateSchema,
  mediaRatingSchema,
  mediaTranslationsSchema,
} from "@chia/db/validator/media";

export const mediaKindSchema = z.enum(MediaKind);
export const mediaStatusSchema = z.enum(MediaStatus);
export const mediaSourceSchema = z.enum(MediaSource);

const LIST_LIMIT_MAX = 500;
const SEARCH_QUERY_MAX_CHARS = 100;
const RELEASE_YEAR_MIN = 1870;
const RELEASE_YEAR_MAX = 2200;

/** What the owner records about a work, as opposed to the catalogue's facts about it. */
const logFields = {
  status: mediaStatusSchema,
  rating: mediaRatingSchema.nullable(),
  favorite: z.boolean(),
  startedOn: mediaDateSchema.nullable(),
  finishedOn: mediaDateSchema.nullable(),
};

const endsAfterStart = (value: {
  startedOn: string | null;
  finishedOn: string | null;
}) =>
  value.startedOn === null ||
  value.finishedOn === null ||
  value.finishedOn >= value.startedOn;

const ENDS_AFTER_START = {
  message: "finishedOn must not precede startedOn",
  path: ["finishedOn"],
};

const entryIdSchema = z.object({ id: z.number().int().positive() });

const SLUG_MAX_CHARS = 200;
const PLAYTIME_MAX_MINUTES = 60 * 24 * 365 * 20;
const ACHIEVEMENTS_MAX = 10_000;

/** A game's play stats as the owner may type them; `lastPlayedAt` only ever comes from Steam. */
const playStatFields = {
  steamAppId: z.number().int().positive().nullable(),
  playtimeMinutes: z.number().int().min(0).max(PLAYTIME_MAX_MINUTES).nullable(),
  achievementsUnlocked: z
    .number()
    .int()
    .min(0)
    .max(ACHIEVEMENTS_MAX)
    .nullable(),
  achievementsTotal: z.number().int().min(0).max(ACHIEVEMENTS_MAX).nullable(),
};

const unlockedWithinTotal = (value: {
  achievementsUnlocked: number | null;
  achievementsTotal: number | null;
}) =>
  value.achievementsUnlocked === null ||
  value.achievementsTotal === null ||
  value.achievementsUnlocked <= value.achievementsTotal;

const UNLOCKED_WITHIN_TOTAL = {
  message: "achievementsUnlocked must not exceed achievementsTotal",
  path: ["achievementsUnlocked"],
};

const entrySchema = entryIdSchema.extend({
  /** Names the work in its public URL. */
  slug: z.string(),
  kind: mediaKindSchema,
  source: mediaSourceSchema,
  sourceUrl: z.string().nullable(),
  translations: mediaTranslationsSchema,
  originalTitle: z.string().nullable(),
  releaseYear: z.number().int().nullable(),
  /** Absolute URL of the cover in the site's storage. */
  posterUrl: z.string().nullable(),
  /** Absolute URL of the landscape key art in the site's storage. */
  backdropUrl: z.string().nullable(),
  /** The cover's dominant colour as `#rrggbb`. */
  color: mediaColorSchema.nullable(),
  ...logFields,
  ...playStatFields,
  lastPlayedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** One achievement of a game: Steam's definition of it and where the owner stands on it. */
const achievementSchema = z.object({
  /** Steam's own name for it; unique within a game. */
  apiName: z.string(),
  translations: mediaAchievementTranslationsSchema,
  /** On Steam's CDN. */
  iconUrl: z.string(),
  /** The greyed icon Steam shows before the unlock. */
  lockedIconUrl: z.string(),
  /** Steam keeps its description back until it is unlocked. */
  hidden: z.boolean(),
  /** Share of the game's players who hold it, 0 to 100. */
  globalPercent: z.number().nullable(),
  unlocked: z.boolean(),
  /** `null` while locked, and for an unlock older than Steam's record of the time. */
  unlockedAt: z.date().nullable(),
});

/** A work as a catalogue lists it, before it is added. */
const candidateSchema = z.object({
  source: mediaSourceSchema,
  sourceId: z.string(),
  title: z.string(),
  originalTitle: z.string().nullable(),
  releaseYear: z.number().int().nullable(),
  /** The catalogue's own image URL. */
  posterUrl: z.string().nullable(),
  url: z.string(),
});

const readErrors = {
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  TOO_MANY_REQUESTS: {},
  INTERNAL_SERVER_ERROR: {},
};
const adminErrors = {
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  NOT_FOUND: {},
  BAD_REQUEST: {},
  INTERNAL_SERVER_ERROR: {},
} as const;

/** Public. Newest activity first; `limit` caps a shelf, it does not page. */
export const listMediaEntriesContract = oc
  .errors(readErrors)
  .input(
    z.object({
      kind: mediaKindSchema.optional(),
      status: mediaStatusSchema.optional(),
      favorite: z.boolean().optional(),
      limit: z.number().int().min(1).max(LIST_LIMIT_MAX).optional(),
    })
  )
  .output(z.object({ items: z.array(entrySchema) }));

/** Public. One work by the slug in its URL; `achievements` is empty for anything but a synced game. */
export const getMediaEntryContract = oc
  .errors({ ...readErrors, NOT_FOUND: {} })
  .input(z.object({ slug: z.string().min(1).max(SLUG_MAX_CHARS) }))
  .output(
    z.object({ entry: entrySchema, achievements: z.array(achievementSchema) })
  );

/** Searches the catalogues that carry `kind`. */
export const searchMediaContract = oc
  .errors({ ...adminErrors, SERVICE_UNAVAILABLE: {} })
  .input(
    z.object({
      kind: mediaKindSchema,
      query: z.string().trim().min(1).max(SEARCH_QUERY_MAX_CHARS),
    })
  )
  .output(z.object({ items: z.array(candidateSchema) }));

/** Snapshots the work from its catalogue and copies its cover and key art into storage. */
export const createMediaEntryContract = oc
  .errors({ ...adminErrors, CONFLICT: {}, SERVICE_UNAVAILABLE: {} })
  .input(
    z
      .object({
        kind: mediaKindSchema,
        source: mediaSourceSchema,
        sourceId: z.string().trim().min(1).max(40),
        ...logFields,
      })
      .refine(endsAfterStart, ENDS_AFTER_START)
  )
  .output(z.object({ entry: entrySchema }));

export const updateMediaEntryContract = oc
  .errors(adminErrors)
  .input(
    entryIdSchema
      .extend({
        translations: mediaTranslationsSchema,
        originalTitle: z
          .string()
          .trim()
          .min(1)
          .max(MEDIA_TITLE_MAX_CHARS)
          .nullable(),
        releaseYear: z
          .number()
          .int()
          .min(RELEASE_YEAR_MIN)
          .max(RELEASE_YEAR_MAX)
          .nullable(),
        color: mediaColorSchema.nullable(),
        ...logFields,
        ...playStatFields,
      })
      .refine(endsAfterStart, ENDS_AFTER_START)
      .refine(unlockedWithinTotal, UNLOCKED_WITHIN_TOTAL)
  )
  .output(z.object({ entry: entrySchema }));

/** Reads a game's play stats and achievements from Steam and stores them. The entry must name a Steam app. */
export const syncMediaEntryContract = oc
  .errors({ ...adminErrors, SERVICE_UNAVAILABLE: {} })
  .input(entryIdSchema)
  .output(z.object({ entry: entrySchema }));

export const removeMediaEntryContract = oc
  .errors(adminErrors)
  .input(entryIdSchema)
  .output(entryIdSchema);

export type MediaEntryView = z.infer<typeof entrySchema>;
export type MediaAchievementView = z.infer<typeof achievementSchema>;
export type MediaCandidate = z.infer<typeof candidateSchema>;

export const mediaContract = {
  list: listMediaEntriesContract,
  get: getMediaEntryContract,
  search: searchMediaContract,
  create: createMediaEntryContract,
  update: updateMediaEntryContract,
  sync: syncMediaEntryContract,
  remove: removeMediaEntryContract,
};
