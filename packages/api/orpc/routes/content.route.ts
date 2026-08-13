import {
  getFeedById,
  getFeedBySlug,
  getFeedIdByTranslationId,
  getInfiniteFeedsByUserId,
  updateFeed,
  upsertContent,
  upsertFeedTranslation,
} from "@chia/db/repos/feeds";
import { getPublicFeedsTotal } from "@chia/db/repos/public/feeds";

import {
  getRelatedFeedsService,
  searchFeedsService,
  searchPublicFeedsService,
} from "../../feeds/search";
import { feedEvents } from "../events";
import { adminIdGuard } from "../guards/admin.guard";
import { apiKeyGuard } from "../guards/apikey.guard";
import { sessionGuard } from "../guards/auth.guard";
import { rateLimitGuard } from "../guards/rate-limit.guard";
import { contractOS } from "../utils";

// ============================================
// Public reads (API key + configured admin)
//
// `apps/www` is deployed on Vercel while the service runs on Railway, so every call
// crosses the public internet and carries the project API key. On top of that, these
// procedures back a single-author public blog: the visible set is *always* the configured
// admin's published feeds, so the scope is fixed in the handler rather than accepted as
// input. A caller holding the API key still cannot ask for someone else's feeds or for
// unpublished drafts.
// ============================================

const publicFeedGuard = apiKeyGuard();

/**
 * The only scope the public read surface may ever use.
 *
 * `PUBLIC_SCOPE` is the detail-query shape, `PUBLIC_LIST_SCOPE` the list-query shape —
 * the repository spells the published filter differently for the two.
 */
const PUBLIC_SCOPE = (adminId: string) => ({
  userId: adminId,
  published: true as const,
});

const PUBLIC_LIST_SCOPE = (adminId: string) => ({
  userId: adminId,
  whereAnd: { published: true },
});

export const getPublicFeedsRoute = contractOS.content.feeds.list
  .use(publicFeedGuard)
  .use(adminIdGuard)
  .handler(async (opts) => {
    const data = await getInfiniteFeedsByUserId(opts.context.db, {
      type: opts.input.type,
      limit: opts.input.limit,
      orderBy: opts.input.orderBy,
      sortOrder: opts.input.sortOrder,
      cursor: opts.input.nextCursor,
      withContent: opts.input.withContent,
      locale: opts.input.locale,
      ...PUBLIC_LIST_SCOPE(opts.context.adminId),
    });

    return data;
  });

export const getPublicFeedsTotalRoute = contractOS.content.feeds.total
  .use(publicFeedGuard)
  .use(adminIdGuard)
  .handler(async (opts) => {
    return {
      total:
        (await getPublicFeedsTotal(opts.context.db, opts.context.adminId)) ?? 0,
    };
  });

export const getPublicFeedBySlugRoute = contractOS.content.feeds[
  "details-by-slug"
]
  .use(publicFeedGuard)
  .use(adminIdGuard)
  .handler(async (opts) => {
    const feed = await getFeedBySlug(opts.context.db, {
      slug: opts.input.slug,
      locale: opts.input.locale,
      ...PUBLIC_SCOPE(opts.context.adminId),
    });

    if (!feed) {
      throw opts.errors.NOT_FOUND();
    }

    return feed;
  });

export const getPublicFeedByIdRoute = contractOS.content.feeds["details-by-id"]
  .use(publicFeedGuard)
  .use(adminIdGuard)
  .handler(async (opts) => {
    const feed = await getFeedById(opts.context.db, {
      feedId: opts.input.feedId,
      locale: opts.input.locale,
      ...PUBLIC_SCOPE(opts.context.adminId),
    });

    if (!feed) {
      throw opts.errors.NOT_FOUND();
    }

    return feed;
  });

export const getPublicRelatedFeedsRoute = contractOS.content.feeds.related
  .use(publicFeedGuard)
  .handler(async (opts) => {
    const items = await getRelatedFeedsService({
      db: opts.context.db,
      kv: opts.context.kv,
      slug: opts.input.slug,
      locale: opts.input.locale,
      limit: opts.input.limit,
    });

    return { items };
  });

// ============================================
// Public writes (API key)
// ============================================

export const upsertPublicFeedTranslationRoute = contractOS.content.feeds[
  "translation:upsert"
]
  .use(publicFeedGuard)
  .handler(async (opts) => {
    const translation = await upsertFeedTranslation(
      opts.context.db,
      opts.input
    );

    if (translation) {
      await feedEvents.changed(translation.feedId);
    }
  });

export const upsertPublicFeedContentRoute = contractOS.content.feeds[
  "content:upsert"
]
  .use(publicFeedGuard)
  .handler(async (opts) => {
    await upsertContent(opts.context.db, opts.input);

    const feedID = await getFeedIdByTranslationId(opts.context.db, {
      translationId: opts.input.feedTranslationId,
    });

    if (feedID) {
      await feedEvents.changed(feedID);
    }
  });

export const updatePublicFeedRoute = contractOS.content.feeds.update
  .use(publicFeedGuard)
  .handler(async (opts) => {
    const feed = await updateFeed(opts.context.db, opts.input);

    if (feed) {
      await feedEvents.changed(feed.id);
    }

    return feed ?? null;
  });

// ============================================
// Search
// ============================================

/**
 * Public counterpart of `list` for the browser — no API key, but the same fixed scope, so
 * it can never surface a draft or another author's feed.
 */
export const listPublicFeedsRoute = contractOS.content.feeds["public-list"]
  .use(rateLimitGuard({ prefix: "rate-limiter:feeds" }))
  .use(adminIdGuard)
  .handler(async (opts) => {
    const data = await getInfiniteFeedsByUserId(opts.context.db, {
      type: opts.input.type,
      limit: opts.input.limit,
      orderBy: opts.input.orderBy,
      sortOrder: opts.input.sortOrder,
      cursor: opts.input.nextCursor,
      withContent: opts.input.withContent,
      locale: opts.input.locale,
      ...PUBLIC_LIST_SCOPE(opts.context.adminId),
    });

    if (!data) {
      throw opts.errors.NOT_FOUND();
    }

    return data;
  });

export const searchPublicFeedsRoute = contractOS.content.feeds["public-search"]
  .use(rateLimitGuard({ prefix: "rate-limiter:feeds" }))
  .handler(async (opts) => {
    const items = await searchPublicFeedsService({
      db: opts.context.db,
      keyword: opts.input.keyword,
      locale: opts.input.locale,
      limit: opts.input.limit,
    });

    return { items };
  });

export const searchFeedsRoute = contractOS.content.feeds.search
  .use(rateLimitGuard({ prefix: "rate-limiter:feeds" }))
  /**
   * Authenticated for every mode, and root-only for the modes that embed the
   * query — those spend the server's embedding credentials, `bm25` does not.
   *
   * The provider is resolved server-side now, so there is no caller-supplied
   * key to gate on (the old `aiKeyGuard` covered the BYO-key path).
   */
  .use(sessionGuard, (input) => ({
    rootOnly: input.model !== "bm25",
  }))
  .handler(async (opts) => {
    const { keyword, model, locale } = opts.input;

    return await searchFeedsService({
      db: opts.context.db,
      keyword,
      model,
      locale,
    });
  });
