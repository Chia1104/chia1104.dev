import { oc } from "@orpc/contract";
import * as z from "zod";

import { locale } from "@chia/db/schema/enums";
import { FeedOrderBy, FeedType, Locale } from "@chia/db/types";
import {
  feedSchema,
  feedTranslationSchema,
  insertFeedSchema,
  insertContentSchema,
} from "@chia/db/validator/feeds";

import type { SearchFeedsServiceResult } from "../../feeds/search";
import {
  publicFeedSearchItemSchema,
  searchFeedsSchema,
  upsertContentRequestSchema,
  upsertFeedTranslationRequestSchema,
} from "../../feeds/validator";

import { withMetaSchema } from "./shared";

/** One feed surface; scope widens with `context.caller.tier`. See `feeds/access.ts`. */

const dateFields = {
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
};

export const createFeedSchema = insertFeedSchema
  .omit({ userId: true, createdAt: true, updatedAt: true })
  .extend({
    slug: z.string().min(1),
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
    ...dateFields,
  });

export type CreateFeedInput = z.infer<typeof createFeedSchema>;

export const updateFeedSchema = insertFeedSchema
  .omit({
    userId: true,
    createdAt: true,
    updatedAt: true,
    slug: true,
  })
  .partial()
  .extend({
    feedId: z.number(),
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
    ...dateFields,
  });

export const deleteFeedSchema = z.object({
  feedId: z.number(),
  hard: z.boolean().optional().default(false),
});

export const restoreFeedSchema = z.object({
  feedId: z.number(),
});

/**
 * Accepts a JSON boolean or its query-string spelling, so the same schema works over RPC
 * (real JSON) and over the OpenAPI mount (every value a string).
 */
const flexibleBoolean = z.union([z.boolean(), z.stringbool()]);

/** `resolveFeedVisibility` clamps each flag for callers below the required tier rather than rejecting, so a browser that sends `includeUnpublished` receives the published set instead of a 403. */
const feedVisibilityFields = {
  /** Include drafts. Requires an API key or a session. */
  includeUnpublished: flexibleBoolean.optional().default(false),
  /** Include soft-deleted feeds. Requires a session. */
  includeDeleted: flexibleBoolean.optional().default(false),
};

const localeQueryFields = {
  locale: z.enum(locale.enumValues).optional().default(Locale.zhTW),
};

/** `userId` is absent: this is a single-author site, so the author is derived from the caller's tier. */
export const feedsInfiniteSchema = z.object({
  /**
   * Clamped per tier by `resolveFeedLimit` — an anonymous caller cannot walk the whole
   * table in one call, while `apps/www`'s sitemap can ask for 1000 with its API key.
   */
  limit: z.coerce.number().int().positive().optional().default(20),
  // Composite feed cursors are strings (`feed:[timestamp,id]`); bare numeric ids still work.
  nextCursor: z.union([z.string(), z.number()]).optional(),
  withContent: flexibleBoolean.optional().default(false),
  orderBy: z.enum(FeedOrderBy).optional().default(FeedOrderBy.CreatedAt),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  type: z.enum(FeedType).optional(),
  ...localeQueryFields,
  ...feedVisibilityFields,
});

export const getFeedBySlugSchema = z.object({
  slug: z.string().min(1),
  ...localeQueryFields,
  ...feedVisibilityFields,
});

/**
 * No locale default: the dash edit view needs every translation. Defaulting to `zh-TW`
 * filtered the rest out.
 */
export const getFeedByIdSchema = z.object({
  feedId: z.coerce.number().int(),
  locale: z.enum(locale.enumValues).optional(),
  ...feedVisibilityFields,
});

/**
 * `published`/`deleted` stay on the feed. Body columns are optional because list
 * queries skip them unless `withContent` was set.
 */
const translationOutputSchema = feedTranslationSchema
  .omit({
    createdAt: true,
    updatedAt: true,
    published: true,
    deleted: true,
    content: true,
    source: true,
    unstableSerializedSource: true,
  })
  .extend({
    content: z.string().nullable().optional(),
    source: z.string().nullable().optional(),
    unstableSerializedSource: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    hasEmbedding: z.boolean(),
  });

export const feedWithTranslationsSchema = feedSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  translations: z.array(translationOutputSchema),
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

export const feedListSchema = feedWithTranslationsSchema;

export const relatedFeedItemSchema = z.object({
  id: z.number(),
  type: z.string(),
  slug: z.string(),
  locale: z.enum(locale.enumValues),
  title: z.string(),
  description: z.string().nullable(),
  excerpt: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  similarity: z.number().optional(),
});

const READ_ERRORS = {
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  NOT_FOUND: {},
  TOO_MANY_REQUESTS: {},
  INTERNAL_SERVER_ERROR: {},
} as const;

export const getFeedsContract = oc
  .errors(READ_ERRORS)
  .input(feedsInfiniteSchema)
  .output(withMetaSchema(feedListSchema));

export const getFeedBySlugContract = oc
  .errors(READ_ERRORS)
  .input(getFeedBySlugSchema)
  .output(feedWithTranslationsSchema);

export const getFeedByIdContract = oc
  .errors(READ_ERRORS)
  .input(getFeedByIdSchema)
  .output(feedWithTranslationsSchema);

export const getRelatedFeedsContract = oc
  .errors(READ_ERRORS)
  .input(
    z.object({
      slug: z.string().min(1),
      ...localeQueryFields,
      limit: z.coerce.number().int().min(1).max(6).optional().default(3),
    })
  )
  .output(z.object({ items: z.array(relatedFeedItemSchema) }));

// Two procedures: `search` returns display items; `search:advanced` returns whichever
// shape the retrieval mode produced.

export const searchFeedsContract = oc
  .errors({
    BAD_REQUEST: {},
    TOO_MANY_REQUESTS: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(
    z.object({
      keyword: z.string().trim().min(2).max(100),
      ...localeQueryFields,
      limit: z.coerce.number().int().min(1).max(10).optional().default(5),
    })
  )
  .output(z.object({ items: z.array(publicFeedSearchItemSchema) }));

/**
 * Output is `z.custom` because the payload shape depends on the requested retrieval mode
 * and all of them are pass-through; mirroring each shape in a zod union would duplicate
 * types the repositories already own.
 */
export const searchFeedsAdvancedContract = oc
  .errors({
    BAD_REQUEST: {},
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    TOO_MANY_REQUESTS: {},
    SERVICE_UNAVAILABLE: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(
    searchFeedsSchema.extend({
      locale: z.enum(locale.enumValues).optional(),
    })
  )
  .output(z.custom<SearchFeedsServiceResult>());

const WRITE_ERRORS = {
  UNAUTHORIZED: {},
  FORBIDDEN: {},
  NOT_FOUND: {},
  BAD_REQUEST: {},
  INTERNAL_SERVER_ERROR: {},
} as const;

export const createFeedContract = oc
  .errors(WRITE_ERRORS)
  .input(createFeedSchema);

export const updateFeedContract = oc
  .errors(WRITE_ERRORS)
  .input(updateFeedSchema);

export const deleteFeedContract = oc
  .errors(WRITE_ERRORS)
  .input(deleteFeedSchema);

export const restoreFeedContract = oc
  .errors(WRITE_ERRORS)
  .input(restoreFeedSchema);

export const upsertFeedTranslationContract = oc
  .errors(WRITE_ERRORS)
  .input(upsertFeedTranslationRequestSchema)
  .output(z.void());

export const upsertContentContract = oc
  .errors(WRITE_ERRORS)
  .input(upsertContentRequestSchema)
  .output(z.void());
