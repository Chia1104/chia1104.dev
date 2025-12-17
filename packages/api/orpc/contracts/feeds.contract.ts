import { oc } from "@orpc/contract";
import * as z from "zod";

import {
  infiniteSchema,
  feedSchema,
  contentSchema,
  feedMetaSchema,
} from "@chia/db/validator/feeds";

import {
  createFeedSchema,
  deleteFeedSchema,
  updateFeedSchema,
} from "../validators";

const withMetaSchema = (schema: z.ZodType) =>
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
        content: contentSchema.shape,
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
        content: contentSchema.shape,
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
      content: contentSchema.shape,
      feedMeta: feedMetaSchema.shape,
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
      content: contentSchema.shape,
      feedMeta: feedMetaSchema.shape,
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
