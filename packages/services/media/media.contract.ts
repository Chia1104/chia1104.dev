import { oc } from "@orpc/contract";
import * as z from "zod";

import { MediaKind, MediaSource, MediaStatus } from "@chia/db/types";
import {
  MEDIA_TITLE_MAX_CHARS,
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

const entrySchema = entryIdSchema.extend({
  kind: mediaKindSchema,
  source: mediaSourceSchema,
  sourceUrl: z.string().nullable(),
  translations: mediaTranslationsSchema,
  originalTitle: z.string().nullable(),
  releaseYear: z.number().int().nullable(),
  /** Absolute URL of the cover in the site's storage. */
  posterUrl: z.string().nullable(),
  ...logFields,
  createdAt: z.date(),
  updatedAt: z.date(),
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

/** Snapshots the work from its catalogue and copies its cover into storage. */
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
        ...logFields,
      })
      .refine(endsAfterStart, ENDS_AFTER_START)
  )
  .output(z.object({ entry: entrySchema }));

export const removeMediaEntryContract = oc
  .errors(adminErrors)
  .input(entryIdSchema)
  .output(entryIdSchema);

export type MediaEntryView = z.infer<typeof entrySchema>;
export type MediaCandidate = z.infer<typeof candidateSchema>;

export const mediaContract = {
  list: listMediaEntriesContract,
  search: searchMediaContract,
  create: createMediaEntryContract,
  update: updateMediaEntryContract,
  remove: removeMediaEntryContract,
};
