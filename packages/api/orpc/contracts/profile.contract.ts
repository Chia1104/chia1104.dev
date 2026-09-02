import { oc } from "@orpc/contract";
import * as z from "zod";

import { ProfileEntryKind } from "@chia/db/types";
import { profileEntryContentSchema } from "@chia/db/validator/profile";

/**
 * RPC-only and admin-only for now. The profile is the operator's résumé; a published read
 * for the public site is the seam to widen later, not a second contract.
 */

export const profileEntryKindSchema = z.enum(ProfileEntryKind);

const SORT_ORDER_LIMIT = 10_000;

/** What a caller sets on every write. `data` has no partial form, so writes carry the whole row. */
const entryFields = {
  published: z.boolean(),
  sortOrder: z.number().int().min(-SORT_ORDER_LIMIT).max(SORT_ORDER_LIMIT),
};

const entryIdSchema = z.object({ id: z.number().int().positive() });

const entrySchema = z.intersection(
  entryIdSchema.extend({
    ...entryFields,
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
  profileEntryContentSchema
);

const readErrors = {
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  INTERNAL_SERVER_ERROR: {},
};
const writeErrors = {
  ...readErrors,
  NOT_FOUND: {},
  BAD_REQUEST: {},
} as const;

/** Unpaginated: the profile is bounded. Ordered by kind, then `sortOrder`, then id. */
export const listProfileEntriesContract = oc
  .errors(readErrors)
  .input(z.object({ kind: profileEntryKindSchema.optional() }))
  .output(z.object({ items: z.array(entrySchema) }));

export const getProfileEntryContract = oc
  .errors({ ...readErrors, NOT_FOUND: {} })
  .input(entryIdSchema)
  .output(z.object({ entry: entrySchema }));

const entryWriteSchema = z.intersection(
  z.object(entryFields),
  profileEntryContentSchema
);

export const createProfileEntryContract = oc
  .errors(writeErrors)
  .input(entryWriteSchema)
  .output(z.object({ entry: entrySchema }));

export const updateProfileEntryContract = oc
  .errors(writeErrors)
  .input(
    z.intersection(entryIdSchema.extend(entryFields), profileEntryContentSchema)
  )
  .output(z.object({ entry: entrySchema }));

/** Soft delete. */
export const removeProfileEntryContract = oc
  .errors(writeErrors)
  .input(entryIdSchema)
  .output(entryIdSchema);

export type ProfileEntryView = z.infer<typeof entrySchema>;
export type ProfileEntryWrite = z.input<typeof entryWriteSchema>;
