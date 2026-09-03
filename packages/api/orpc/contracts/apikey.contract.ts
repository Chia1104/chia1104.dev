import { oc } from "@orpc/contract";
import * as z from "zod";

import { apiKeyPermissionsSchema, apiKeyScopesSchema } from "@chia/auth/apikey";
import { baseInfiniteSchema } from "@chia/db/validator/apikey";

export const createAPIKeySchema = z.object({
  name: z.string().optional(),
  scopes: apiKeyScopesSchema,
});

export const baseApiKeySchema = z.object({
  key: z.string(),
  metadata: z.any(),
  permissions: apiKeyPermissionsSchema.nullable(),
  id: z.string(),
  name: z.string().nullable(),
  start: z.string().nullable(),
  prefix: z.string().nullable(),
  referenceId: z.string(),
  configId: z.string(),
  refillInterval: z.number().nullable(),
  refillAmount: z.number().nullable(),
  enabled: z.boolean().nullable(),
  rateLimitEnabled: z.boolean().nullable(),
  rateLimitTimeWindow: z.number().nullable(),
  rateLimitMax: z.number().nullable(),
  requestCount: z.number().nullable(),
  remaining: z.number().nullable(),
});

// https://github.com/better-auth/better-auth/blob/canary/packages/better-auth/src/plugins/api-key/types.ts
export const originalApiKeySchema = baseApiKeySchema
  .extend({
    lastRequest: z.date().nullable(),
    lastRefillAt: z.date().nullable(),
    expiresAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .transform((data) => ({
    ...data,
    updatedAt: data.updatedAt.toISOString(),
    createdAt: data.createdAt.toISOString(),
    lastRefillAt: data.lastRefillAt?.toISOString() ?? null,
    expiresAt: data.expiresAt?.toISOString() ?? null,
    lastRequest: data.lastRequest?.toISOString() ?? null,
  }));

export const apiKeySchema = baseApiKeySchema.extend({
  lastRequest: z.string().nullable(),
  lastRefillAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createAPIKeyContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(createAPIKeySchema)
  .output(originalApiKeySchema);

export const getAllApiKeysWithMetaContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(baseInfiniteSchema.optional())
  .output(
    z.object({
      items: z.array(apiKeySchema),
      nextCursor: z.union([z.string(), z.number()]).nullable(),
    })
  );

export const revokeApiKeyContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(z.string());

export const deleteApiKeyContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(z.string());

export const updateApiKeyContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(
    z.object({
      name: z.string(),
      keyId: z.string(),
      scopes: apiKeyScopesSchema.optional(),
    })
  );
