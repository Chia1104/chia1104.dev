import { oc } from "@orpc/contract";
import * as z from "zod";

import { listUsersSchema } from "@chia/db/validator/users";

import { withMetaSchema } from "./shared";

const READ_ERRORS = {
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  INTERNAL_SERVER_ERROR: {},
} as const;

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  role: z.string(),
  /** Guest minted by better-auth `anonymous()`. */
  isAnonymous: z.boolean(),
  banned: z.boolean(),
  banReason: z.string().nullable(),
  /** ISO instant; `null` is a ban with no end. */
  banExpires: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Sessions are absent on purpose: better-auth keeps them in secondary storage, so the `session` table is empty. */
export const userDetailSchema = z.object({
  user: userSchema.extend({ emailVerified: z.boolean() }),
  accounts: z.array(
    z.object({ providerId: z.string(), createdAt: z.string() })
  ),
  passkeys: z.number().int(),
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

export type UserDetail = z.infer<typeof userDetailSchema>;
