import * as z from "zod";

import {
  insertFeedSchema,
  insertFeedContentSchema,
} from "@chia/db/validator/feeds";

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

  // userId: z
  //   .string({
  //     description:
  //       "User Id of the user that the Api Key belongs to. Useful for server-side only.",
  //   })
  //   .optional(),
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
