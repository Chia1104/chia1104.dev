import { oc } from "@orpc/contract";
import * as z from "zod";

import { locale } from "@chia/db";
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

/**
 * One feed surface for every audience.
 *
 * The reads used to exist three times over — once for the browser, once for `apps/www`'s
 * API-key-authenticated RSC calls, and once for a dash session — because each audience
 * needed a different slice of the same table. They are now single procedures whose scope
 * widens with `context.caller.tier`; see `feeds/access.ts` for the rule and
 * `__tests__/feeds-access.test.ts` for the cases that pin it down.
 */

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

/**
 * Requests to widen the visible set beyond the public one.
 *
 * These are *requests*, never assertions: `resolveFeedVisibility` clamps each one away
 * for callers below the required tier rather than rejecting the call, so a browser that
 * sends `includeUnpublished` receives the published set instead of a 403.
 */
const feedVisibilitySchema = z.object({
  /** Include drafts. Requires the project API key or a session. */
  includeUnpublished: flexibleBoolean.optional().default(false),
  /** Include soft-deleted feeds. Requires a session. */
  includeDeleted: flexibleBoolean.optional().default(false),
});

const localeQuerySchema = z.object({
  locale: z.enum(locale.enumValues).optional().default(Locale.zhTW),
});

/**
 * Input for the feed list.
 *
 * `userId` is deliberately absent: this is a single-author site, so the author is derived
 * from the caller's tier rather than accepted from the request.
 */
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
  ...localeQuerySchema.shape,
  ...feedVisibilitySchema.shape,
});

export const getFeedBySlugSchema = z.object({
  slug: z.string().min(1),
  ...localeQuerySchema.shape,
  ...feedVisibilitySchema.shape,
});

export const getFeedByIdSchema = z.object({
  feedId: z.coerce.number().int(),
  ...localeQuerySchema.shape,
  ...feedVisibilitySchema.shape,
});

// ============================================
// Output Schemas
// ============================================

/**
 * What a translation looks like on the wire.
 *
 * `published`/`deleted` mirror `feed` and stay server-side; a client reads them
 * from the feed. The body columns are optional because list queries skip them
 * unless `withContent` was set.
 */
const translationOutputSchema = z.object({
  ...feedTranslationSchema.omit({
    createdAt: true,
    updatedAt: true,
    published: true,
    deleted: true,
    content: true,
    source: true,
    unstableSerializedSource: true,
  }).shape,
  content: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  unstableSerializedSource: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  hasEmbedding: z.boolean(),
});

export const feedWithTranslationsSchema = z.object({
  ...feedSchema.shape,
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

/**
 * Identical to {@link feedWithTranslationsSchema} — it used to differ only by
 * carrying no content, which is now expressed by the body columns being
 * optional on the shared translation shape.
 */
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

// ============================================
// Reads
// ============================================

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
      ...localeQuerySchema.shape,
      limit: z.coerce.number().int().min(1).max(6).optional().default(3),
    })
  )
  .output(z.object({ items: z.array(relatedFeedItemSchema) }));

// ============================================
// Search
//
// Two procedures rather than one: they answer different questions and, unlike the reads
// above, cannot share an output. `search` backs a search box and returns display items;
// `search:advanced` is an operator tool that returns whichever shape the requested
// retrieval mode produced.
// ============================================

export const searchFeedsContract = oc
  .errors({
    BAD_REQUEST: {},
    TOO_MANY_REQUESTS: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(
    z.object({
      keyword: z.string().trim().min(2).max(100),
      ...localeQuerySchema.shape,
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
    z.object({
      ...searchFeedsSchema.shape,
      locale: z.enum(locale.enumValues).optional(),
    })
  )
  .output(z.custom<SearchFeedsServiceResult>());

// ============================================
// Writes
// ============================================

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
