import { oc } from "@orpc/contract";
import * as z from "zod";

import { listUsersSchema } from "@chia/db/validator/users";

import { withMetaSchema } from "../shared/schema";

const READ_ERRORS = {
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  INTERNAL_SERVER_ERROR: {},
} as const;

const WRITE_ERRORS = {
  ...READ_ERRORS,
  NOT_FOUND: {},
  BAD_REQUEST: {},
} as const;

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** `null` for a guest. */
  email: z.string().nullable(),
  image: z.string().nullable(),
  /** Guest who passed the captcha but never signed in. */
  isAnonymous: z.boolean(),
  banned: z.boolean(),
  banReason: z.string().nullable(),
  /** ISO instant; `null` is a ban with no end. */
  banExpires: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const userDetailSchema = z.object({
  user: userSchema,
  accounts: z.array(
    z.object({ providerId: z.string(), createdAt: z.string() })
  ),
  /** Unexpired sign-in sessions. */
  sessions: z.number().int(),
  apiKeys: z.number().int(),
});

export const listUsersContract = oc
  .errors(READ_ERRORS)
  .input(listUsersSchema)
  .output(
    withMetaSchema(userSchema).extend({
      /** Narrowed from `withMetaSchema`: a `(timestamp, id)` keyset cursor. */
      nextCursor: z.string().nullable(),
    })
  );

export const getUserContract = oc
  .errors({ ...READ_ERRORS, NOT_FOUND: {} })
  .input(z.object({ id: z.string().min(1) }))
  .output(userDetailSchema);

const userIdSchema = z.object({ id: z.string().min(1) });

export const banUserContract = oc.errors(WRITE_ERRORS).input(
  userIdSchema.extend({
    reason: z.string().trim().max(200).optional(),
    /** Seconds until the ban lifts; omitted bans for good. */
    expiresIn: z.number().int().positive().optional(),
  })
);

export const unbanUserContract = oc.errors(WRITE_ERRORS).input(userIdSchema);

export const revokeUserSessionsContract = oc
  .errors(WRITE_ERRORS)
  .input(userIdSchema);

export const removeUserContract = oc.errors(WRITE_ERRORS).input(userIdSchema);

/** The caller's own profile; a guest has none to edit. */
export const updateProfileContract = oc
  .errors({ UNAUTHORIZED: {}, NOT_FOUND: {}, INTERNAL_SERVER_ERROR: {} })
  .input(
    z.object({
      name: z.string().trim().min(1).max(100),
      image: z.url().max(2048).nullable(),
    })
  );

export type UserDetail = z.infer<typeof userDetailSchema>;

export const userContract = {
  list: listUsersContract,
  get: getUserContract,
  ban: banUserContract,
  unban: unbanUserContract,
  revokeSessions: revokeUserSessionsContract,
  remove: removeUserContract,
  updateProfile: updateProfileContract,
};
