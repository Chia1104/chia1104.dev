import { oc } from "@orpc/contract";
import * as z from "zod";

import { apiKeyScopeSchema, apiKeyScopesSchema } from "@chia/auth/apikey";
import { baseInfiniteSchema } from "@chia/db/validator/apikey";

const ERRORS = {
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  NOT_FOUND: {},
  INTERNAL_SERVER_ERROR: {},
} as const;

export const createAPIKeySchema = z.object({
  name: z.string().optional(),
  scopes: apiKeyScopesSchema,
});

export const apiKeySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  /** The key's first characters, for telling keys apart. */
  start: z.string().nullable(),
  userId: z.string(),
  scopes: z.array(apiKeyScopeSchema),
  enabled: z.boolean(),
  expiresAt: z.string().nullable(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ApiKey = z.infer<typeof apiKeySchema>;

export const createAPIKeyContract = oc
  .errors(ERRORS)
  .input(createAPIKeySchema)
  .output(
    apiKeySchema.extend({
      /** The raw key, returned once; only its hash is stored. */
      key: z.string(),
    })
  );

export const getAllApiKeysWithMetaContract = oc
  .errors(ERRORS)
  .input(baseInfiniteSchema.optional())
  .output(
    z.object({
      items: z.array(apiKeySchema),
      nextCursor: z.string().nullable(),
    })
  );

export const revokeApiKeyContract = oc
  .errors(ERRORS)
  .input(z.string())
  .output(apiKeySchema);

export const deleteApiKeyContract = oc.errors(ERRORS).input(z.string());

export const updateApiKeyContract = oc
  .errors(ERRORS)
  .input(
    z.object({
      name: z.string(),
      keyId: z.string(),
      scopes: apiKeyScopesSchema.optional(),
    })
  )
  .output(apiKeySchema);

export const apikeyContract = {
  create: createAPIKeyContract,
  list: getAllApiKeysWithMetaContract,
  revoke: revokeApiKeyContract,
  delete: deleteApiKeyContract,
  update: updateApiKeyContract,
};
