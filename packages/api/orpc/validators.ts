import * as z from "zod";

import {
  insertFeedSchema,
  insertFeedContentSchema,
} from "@chia/db/validator/feeds";
import dayjs from "@chia/utils/day";

const dateSchema = z.object({
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export const createFeedSchema = z.object({
  ...insertFeedSchema
    .omit({ userId: true, createdAt: true, updatedAt: true })
    .partial({ slug: true }).shape,
  ...insertFeedContentSchema
    .omit({ feedId: true })
    .partial({ contentType: true }).shape,
  ...dateSchema.shape,
});

export type CreateFeedInput = z.infer<typeof createFeedSchema>;

export const updateFeedSchema = z.object({
  ...insertFeedSchema.omit({
    userId: true,
    createdAt: true,
    updatedAt: true,
    slug: true,
  }).shape,
  ...insertFeedContentSchema.partial({ contentType: true }).shape,
  ...dateSchema.shape,
});

export const deleteFeedSchema = z.object({
  feedId: z.number(),
});

export const createAPIKeySchema = z.object({
  name: z.string().optional(),
  expiresIn: z.number().min(1).optional().nullable().default(null),
  prefix: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message:
        "Invalid prefix format, must be alphanumeric and contain only underscores and hyphens.",
    })
    .optional(),
  remaining: z.number().min(0).optional().nullable().default(null),
  metadata: z.any().optional(),
  refillAmount: z.number().min(1).optional(),
  refillInterval: z.number().optional(),
  rateLimitTimeWindow: z.number().optional(),
  rateLimitMax: z.number().optional(),
  rateLimitEnabled: z.boolean().optional(),
  permissions: z.record(z.string(), z.array(z.string())).optional(),
});

export const baseApiKeySchema = z.object({
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
export const originalApiKeySchema = z
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

export const apiKeySchema = z.object({
  ...baseApiKeySchema.shape,
  key: z.undefined(),
  lastRequest: z.string().nullable(),
  lastRefillAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
