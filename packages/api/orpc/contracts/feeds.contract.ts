import { oc } from "@orpc/contract";
import * as z from "zod";

import { locale } from "@chia/db";
import { FeedOrderBy, FeedType, Locale } from "@chia/db/types";
import {
  infiniteSchema,
  feedSchema,
  feedTranslationSchema,
  contentSchema,
  insertFeedSchema,
  insertContentSchema,
} from "@chia/db/validator/feeds";

import { withMetaSchema } from "./shared";

const dateSchema = z.object({
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

// ============================================
// Input Schemas
// ============================================

export const createFeedSchema = z.object({
  ...insertFeedSchema
    .omit({ userId: true, createdAt: true, updatedAt: true })
    .partial({ slug: true }).shape,
  translations: z.record(
    z.enum(locale.enumValues),
    z.object({
      title: z.string().min(1),
      excerpt: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      summary: z.string().optional().nullable(),
      readTime: z.number().optional().nullable(),
      content: insertContentSchema.optional(),
    })
  ),
  ...dateSchema.shape,
});

export type CreateFeedInput = z.infer<typeof createFeedSchema>;

export const updateFeedSchema = z.object({
  feedId: z.number(),
  ...insertFeedSchema
    .omit({
      userId: true,
      createdAt: true,
      updatedAt: true,
      slug: true,
    })
    .partial().shape,
  translations: z
    .record(
      z.enum(locale.enumValues),
      z.object({
        title: z.string().min(1).optional(),
        excerpt: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        summary: z.string().optional().nullable(),
        readTime: z.number().optional().nullable(),
        content: insertContentSchema.optional(),
      })
    )
    .optional(),
  ...dateSchema.shape,
});

export const upsertFeedTranslationSchema = z.object({
  feedId: z.number(),
  locale: z.enum(locale.enumValues),
  title: z.string().min(1).optional(),
  excerpt: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  readTime: z.number().optional().nullable(),
});

export const upsertContentSchema = z.object({
  feedTranslationId: z.number(),
  content: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  unstableSerializedSource: z.string().optional().nullable(),
});

export const deleteFeedSchema = z.object({
  feedId: z.number(),
  hard: z.boolean().optional().default(false),
});

export const getFeedBySlugSchema = z.object({
  slug: z.string(),
  locale: z.enum(locale.enumValues).optional(),
});

export const getFeedByIdSchema = z.object({
  feedId: z.number(),
  locale: z.enum(locale.enumValues).optional(),
});

/**
 * Accepts a JSON boolean or its query-string spelling.
 *
 * The same procedure is reachable over RPC (where values arrive as real JSON) and as
 * `GET /admin/public/feeds` (where every value is a string), so the flags have to take
 * both. A bare `z.stringbool()` would reject `true`; a bare `z.boolean()` would reject
 * `"true"`.
 */
const flexibleBoolean = z.union([z.boolean(), z.stringbool()]);

/**
 * Input for the public feed list. Mirrors the `getFeedsWithMetaSchema` the Hono route
 * validated with, so the REST URL keeps accepting exactly what it accepted before.
 */
export const publicFeedsInfiniteSchema = z.object({
  // Deliberately uncapped, matching the previous schema: the sitemap asks for every
  // published feed in one call.
  limit: z.coerce.number().int().positive().optional().default(20),
  nextCursor: z.coerce.number().int().optional(),
  withContent: flexibleBoolean.optional().default(false),
  published: flexibleBoolean.optional().default(false),
  locale: z.enum(locale.enumValues).optional().default(Locale.zhTW),
  orderBy: z.enum(FeedOrderBy).optional().default(FeedOrderBy.CreatedAt),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  type: z.enum(FeedType).optional(),
});

// ============================================
// Output Schemas
// ============================================

const serializedContentSchema = contentSchema
  .omit({ createdAt: true, updatedAt: true })
  .extend({
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .nullable();

export const feedWithTranslationsSchema = z.object({
  ...feedSchema.shape,
  deletedAt: z.string().nullable(),
  translations: z.array(
    z.object({
      ...feedTranslationSchema.omit({ createdAt: true, updatedAt: true }).shape,
      createdAt: z.string(),
      updatedAt: z.string(),
      hasEmbedding: z.boolean(),
      content: serializedContentSchema,
    })
  ),
  feedsToTags: z
    .array(
      z.object({
        tag: z
          .object({
            id: z.number(),
            slug: z.string(),
            translations: z.array(
              z.object({
                id: z.number(),
                name: z.string(),
                locale: z.enum(locale.enumValues),
                description: z.string().nullable(),
              })
            ),
          })
          .nullable(),
      })
    )
    .optional(),
});

export const feedListSchema = feedWithTranslationsSchema.extend({
  translations: z.array(
    z.object({
      ...feedTranslationSchema.omit({
        createdAt: true,
        updatedAt: true,
      }).shape,
      createdAt: z.string(),
      updatedAt: z.string(),
      hasEmbedding: z.boolean(),
      content: serializedContentSchema,
    })
  ),
});

// ============================================
// Contracts
// ============================================

export const getFeedsWithMetaContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(infiniteSchema)
  .output(withMetaSchema(feedListSchema));

export const getFeedsWithMetaByAdminIdContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(infiniteSchema)
  .output(withMetaSchema(feedListSchema));

export const getFeedBySlugContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(getFeedBySlugSchema)
  .output(feedWithTranslationsSchema);

export const getFeedByIdContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(getFeedByIdSchema)
  .output(feedWithTranslationsSchema);

export const createFeedContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
    BAD_REQUEST: {
      message: "",
    },
  })
  .input(createFeedSchema);

export const updateFeedContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(updateFeedSchema);

export const upsertFeedTranslationContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(upsertFeedTranslationSchema);

export const upsertContentContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(upsertContentSchema);

export const deleteFeedContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(deleteFeedSchema);

export const restoreFeedSchema = z.object({
  feedId: z.number(),
});

export const restoreFeedContract = oc
  .errors({
    UNAUTHORIZED: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(restoreFeedSchema);
