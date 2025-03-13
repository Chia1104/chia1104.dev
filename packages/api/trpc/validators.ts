import { z } from "zod";

import {
  insertFeedSchema,
  insertFeedContentSchema,
} from "@chia/db/validator/feeds";

const dateSchema = z.object({
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export const createFeedSchema = insertFeedSchema
  .omit({ userId: true, createdAt: true, updatedAt: true })
  .partial({ slug: true })
  .merge(
    insertFeedContentSchema
      .omit({ feedId: true })
      .partial({ contentType: true })
  )
  .merge(dateSchema);

export type CreateFeedInput = z.infer<typeof createFeedSchema>;

export const updateFeedSchema = insertFeedSchema
  .omit({ userId: true, createdAt: true, updatedAt: true })
  .partial()
  .merge(insertFeedContentSchema.partial({ contentType: true }))
  .merge(dateSchema);

export const deleteFeedSchema = z.object({
  feedId: z.number(),
});

export const createAPIKeySchema = z.object({
  name: z.string({ description: "Name of the Api Key" }).optional(),
  expiresIn: z
    .number({
      description: "Expiration time of the Api Key in seconds",
    })
    .min(1)
    .optional()
    .nullable()
    .default(null),

  // userId: z
  //   .string({
  //     description:
  //       "User Id of the user that the Api Key belongs to. Useful for server-side only.",
  //   })
  //   .optional(),
  prefix: z
    .string({ description: "Prefix of the Api Key" })
    .regex(/^[a-zA-Z0-9_-]+$/, {
      message:
        "Invalid prefix format, must be alphanumeric and contain only underscores and hyphens.",
    })
    .optional(),
  remaining: z
    .number({
      description: "Remaining number of requests. Server side only",
    })
    .min(0)
    .optional()
    .nullable()
    .default(null),
  metadata: z.any({ description: "Metadata of the Api Key" }).optional(),
  refillAmount: z
    .number({
      description:
        "Amount to refill the remaining count of the Api Key. Server Only Property",
    })
    .min(1)
    .optional(),
  refillInterval: z
    .number({
      description:
        "Interval to refill the Api Key in milliseconds. Server Only Property.",
    })
    .optional(),
  rateLimitTimeWindow: z
    .number({
      description:
        "The duration in milliseconds where each request is counted. Once the `maxRequests` is reached, the request will be rejected until the `timeWindow` has passed, at which point the `timeWindow` will be reset. Server Only Property.",
    })
    .optional(),
  rateLimitMax: z
    .number({
      description:
        "Maximum amount of requests allowed within a window. Once the `maxRequests` is reached, the request will be rejected until the `timeWindow` has passed, at which point the `timeWindow` will be reset. Server Only Property.",
    })
    .optional(),
  rateLimitEnabled: z
    .boolean({
      description:
        "Whether the key has rate limiting enabled. Server Only Property.",
    })
    .optional(),
  permissions: z.record(z.string(), z.array(z.string())).optional(),
});
