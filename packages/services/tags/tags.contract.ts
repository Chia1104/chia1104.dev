import { oc } from "@orpc/contract";
import * as z from "zod";

import { locale } from "@chia/db/schema/enums";
import {
  tagSlugSchema,
  tagTranslationsSchema,
  tagWriteSchema,
} from "@chia/db/validator/tags";

import { flexibleBoolean } from "../shared/schema";

/**
 * The post taxonomy. Reads are public because the site lists tags; writes are the
 * operator's. A tag reaches a post through `feeds.update`, not here.
 */

const tagIdSchema = z.object({ id: z.number().int().positive() });

const tagTranslationViewSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
});

const tagSchema = tagIdSchema.extend({
  slug: z.string(),
  translations: z.partialRecord(
    z.enum(locale.enumValues),
    tagTranslationViewSchema
  ),
  /** Live posts carrying the tag; drafts counted only when `includeUnpublished` was honoured. */
  feedCount: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const readErrors = {
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  TOO_MANY_REQUESTS: {},
  INTERNAL_SERVER_ERROR: {},
} as const;
const writeErrors = {
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  NOT_FOUND: {},
  BAD_REQUEST: {},
  CONFLICT: {},
  INTERNAL_SERVER_ERROR: {},
} as const;

/** Unpaginated: the taxonomy is bounded. Ordered by slug. */
export const listTagsContract = oc
  .errors(readErrors)
  .input(
    z
      .object({
        /** Count drafts as well. Clamped like `feeds.list`: honoured from an API key up. */
        includeUnpublished: flexibleBoolean.optional().default(false),
      })
      .optional()
      .default({ includeUnpublished: false })
  )
  .output(z.object({ items: z.array(tagSchema) }));

export const createTagContract = oc
  .errors(writeErrors)
  .input(tagWriteSchema)
  .output(z.object({ tag: tagSchema }));

/** Both translations are sent whole. */
export const updateTagContract = oc
  .errors(writeErrors)
  .input(
    tagIdSchema.extend({
      slug: tagSlugSchema,
      translations: tagTranslationsSchema,
    })
  )
  .output(z.object({ tag: tagSchema }));

/** Hard delete; the tag leaves every post it was on. */
export const removeTagContract = oc
  .errors(writeErrors)
  .input(tagIdSchema)
  .output(tagIdSchema);

export type TagView = z.infer<typeof tagSchema>;

export const tagsContract = {
  list: listTagsContract,
  create: createTagContract,
  update: updateTagContract,
  remove: removeTagContract,
};
