import { oc } from "@orpc/contract";
import * as z from "zod";

import { baseInfiniteSchema } from "@chia/db/validator/apikey";
import dayjs from "@chia/utils/day";

import { createAPIKeySchema } from "../validators";

const baseApiKeySchema = z.object({
  key: z.string(),
  metadata: z.any(),
  permissions: z.any(),
  id: z.string(),
  name: z.string().nullable(),
  start: z.string().nullable(),
  prefix: z.string().nullable(),
  userId: z.string(),
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
const originalApiKeySchema = z
  .object({
    ...baseApiKeySchema.shape,
    lastRequest: z.date().nullable(),
    lastRefillAt: z.date().nullable(),
    expiresAt: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .transform((data) => ({
    ...data,
    key: undefined,
    updatedAt: dayjs(data.updatedAt).toISOString(),
    createdAt: dayjs(data.createdAt).toISOString(),
    lastRefillAt: data.lastRefillAt
      ? dayjs(data.lastRefillAt).toISOString()
      : null,
    expiresAt: data.expiresAt ? dayjs(data.expiresAt).toISOString() : null,
    lastRequest: data.lastRequest
      ? dayjs(data.lastRequest).toISOString()
      : null,
  }));

const apiKeySchema = z.object({
  ...baseApiKeySchema.shape,
  key: z.undefined(),
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
  .input(
    z.object({
      projectId: z.number().optional(),
      ...createAPIKeySchema.shape,
    })
  )
  .output(originalApiKeySchema);

export const getAllApiKeysWithMetaContract = oc
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(
    z
      .object({
        ...baseInfiniteSchema.shape,
        withProject: z.boolean().optional(),
      })
      .optional()
  )
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
    })
  );
