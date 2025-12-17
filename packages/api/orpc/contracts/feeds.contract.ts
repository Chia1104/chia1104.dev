import { oc } from "@orpc/contract";
import * as z from "zod";

import {
  infiniteSchema,
  feedSchema,
  contentSchema,
  feedMetaSchema,
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

const withMetaSchema = <Out, In>(schema: z.ZodType<Out, In>) =>
  z.object({
    items: z.array(schema),
    nextCursor: z.union([z.string(), z.number()]).nullable(),
  });

export const getFeedsWithMetaContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(infiniteSchema)
  .output(
    withMetaSchema(
      z.object({
        ...feedSchema.shape,
        content: contentSchema.nullish(),
      })
    )
  );

export const getFeedsWithMetaByAdminIdContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(infiniteSchema)
  .output(
    withMetaSchema(
      z.object({
        ...feedSchema.shape,
        content: contentSchema.nullish(),
      })
    )
  );

export const getFeedBySlugContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(z.object({ slug: z.string() }))
  .output(
    z.object({
      ...feedSchema.shape,
      content: contentSchema.nullish(),
      feedMeta: feedMetaSchema.nullish(),
    })
  );

export const getFeedByIdContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(z.object({ feedId: z.number() }))
  .output(
    z.object({
      ...feedSchema.shape,
      content: contentSchema.nullish(),
      feedMeta: feedMetaSchema.nullish(),
    })
  );

export const createFeedContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(createFeedSchema);

export const updateFeedContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(updateFeedSchema);

export const deleteFeedContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(deleteFeedSchema);
