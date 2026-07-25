import { oc } from "@orpc/contract";
import * as z from "zod";

import { locale } from "@chia/db";
import { Locale } from "@chia/db/types";

import type { SearchFeedsServiceResult } from "../../feeds/search";
import { searchFeedsSchema } from "../../feeds/validator";
import {
  publicFeedSearchItemSchema,
  updateFeedRequestSchema,
  upsertContentRequestSchema,
  upsertFeedTranslationRequestSchema,
} from "../../services/validators";

import {
  feedListSchema,
  feedWithTranslationsSchema,
  publicFeedsInfiniteSchema,
} from "./feeds.contract";
import { withMetaSchema } from "./shared";

/**
 * Public reads of the configured admin's feeds, plus the API-key-authenticated writes the
 * content pipeline uses.
 *
 * Every `path` reproduces the URL the corresponding Hono route served, so the migration
 * is invisible to callers that still speak REST. The odd-looking `feeds:meta` /
 * `feeds:id` segments are literal — they are the shapes the previous routes used.
 */

const localeQuerySchema = z.object({
  locale: z.enum(locale.enumValues).optional().default(Locale.zhTW),
});

export const getPublicFeedsContract = oc
  .route({ method: "GET", path: "/admin/public/feeds" })
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    TOO_MANY_REQUESTS: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(publicFeedsInfiniteSchema)
  .output(withMetaSchema(feedListSchema));

export const getPublicFeedsTotalContract = oc
  .route({ method: "GET", path: "/admin/public/feeds:meta" })
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .output(z.object({ total: z.number() }));

export const getPublicFeedBySlugContract = oc
  .route({ method: "GET", path: "/admin/public/feeds/{slug}" })
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(z.object({ slug: z.string().min(1), ...localeQuerySchema.shape }))
  .output(feedWithTranslationsSchema);

export const getPublicFeedByIdContract = oc
  .route({ method: "GET", path: "/admin/public/feeds:id/{feedId}" })
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(
    z.object({
      feedId: z.coerce.number().int(),
      ...localeQuerySchema.shape,
    })
  )
  .output(feedWithTranslationsSchema);

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

export const getPublicRelatedFeedsContract = oc
  .route({ method: "GET", path: "/admin/public/feeds/{slug}/related" })
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(
    z.object({
      slug: z.string().min(1),
      ...localeQuerySchema.shape,
      limit: z.coerce.number().int().min(1).max(6).optional().default(3),
    })
  )
  .output(z.object({ items: z.array(relatedFeedItemSchema) }));

export const upsertPublicFeedTranslationContract = oc
  .route({
    method: "POST",
    path: "/admin/public/feeds:translation",
    // The Hono route answered 204; oRPC needs a successStatus to match it.
    successStatus: 204,
  })
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    BAD_REQUEST: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(upsertFeedTranslationRequestSchema)
  .output(z.void());

export const upsertPublicFeedContentContract = oc
  .route({
    method: "POST",
    path: "/admin/public/feeds:content",
    successStatus: 204,
  })
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    BAD_REQUEST: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(upsertContentRequestSchema)
  .output(z.void());

/**
 * Kept separate from `feeds.update` rather than merged into it: this one authenticates
 * with an API key (the content pipeline), whereas `feeds.update` requires an admin
 * session. Merging them would have to loosen one of the two.
 *
 * `looseObject` so the repository's row shape passes through unaltered — the previous
 * Hono route returned it verbatim.
 */
export const updatePublicFeedContract = oc
  .route({ method: "POST", path: "/admin/public/feeds/{feedId}" })
  .errors({
    UNAUTHORIZED: {},
    FORBIDDEN: {},
    BAD_REQUEST: {},
    NOT_FOUND: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(
    z.object({
      feedId: z.coerce.number().int(),
      ...updateFeedRequestSchema.shape,
    })
  )
  .output(z.looseObject({ id: z.number() }).nullable());

// ============================================
// Search
// ============================================

/**
 * Public feed list — the browser's infinite scroll.
 *
 * Same data as `list`, but reachable **without** the project API key: the key
 * authenticates one deployment to another (www → service) and cannot be shipped to a
 * browser. Scope is identical and equally fixed in the handler, so the two differ only in
 * who is allowed to call them.
 */
export const listPublicFeedsContract = oc
  .route({ method: "GET", path: "/feeds/public" })
  .errors({
    NOT_FOUND: {},
    TOO_MANY_REQUESTS: {},
    INTERNAL_SERVER_ERROR: {},
  })
  .input(publicFeedsInfiniteSchema)
  .output(withMetaSchema(feedListSchema));

export const searchPublicFeedsContract = oc
  .route({ method: "GET", path: "/feeds/public/search" })
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
 * Vector or Algolia search over the admin's feeds.
 *
 * Output is `z.custom` because the payload shape depends on the requested provider
 * (vector hits vs Algolia hits) and both are pass-through; a zod union of the two would
 * have to mirror Algolia's record shape.
 */
export const searchFeedsContract = oc
  .route({ method: "GET", path: "/feeds/search" })
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
