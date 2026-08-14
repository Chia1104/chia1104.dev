import {
  getFeedById,
  getFeedBySlug,
  getFeedForIndexing,
  getFeedIdByTranslationId,
  getInfiniteFeedsByUserId,
  deleteFeed,
  restoreFeed,
  softDeleteFeed,
  upsertContent,
  upsertFeedTranslation,
} from "@chia/db/repos/feeds";
import { toORPCError } from "@chia/service-kit/adapters/orpc";
import { isAppError } from "@chia/service-kit/errors";
import { CallerTier } from "@chia/service-kit/policies";

import {
  resolveFeedLimit,
  resolveFeedVisibility,
  toFeedDetailScope,
  toFeedListScope,
} from "../../feeds/access";
import {
  getRelatedFeedsService,
  searchFeedsService,
  searchPublicFeedsService,
} from "../../feeds/search";
import { createFeedService, updateFeedService } from "../../feeds/write";
import { feedEvents } from "../events";
import { sessionGuard } from "../guards/auth.guard";
import { callerGuard, tieredRateLimitGuard } from "../guards/caller.guard";
import { contractOS } from "../utils";

// ============================================
// Reads
//
// `resolveFeedVisibility` turns the caller's tier into the slice they may see, and the
// rate-limit budget scales with the same tier. The floor each read sits on is set by who
// can actually reach it:
//
// - `publicReadGuard` — a browser calls these directly (`apps/www`'s infinite scroll and
//   search box), and a browser can never hold the project API key. No floor.
// - `keyedReadGuard` — only `apps/www`'s server-side client calls these, and it always
//   sends `x-ch-api-key`. Anonymous callers have no business here.
// - `sessionReadGuard` — only `apps/dash` calls this, with a session cookie.
// ============================================

const publicReadGuard = callerGuard();
const keyedReadGuard = callerGuard({ minTier: CallerTier.ApiKey });
const sessionReadGuard = callerGuard({ minTier: CallerTier.Session });
const readRateLimit = tieredRateLimitGuard({ prefix: "rate-limiter:feeds" });

export const getFeedsRoute = contractOS.feeds.list
  .use(publicReadGuard)
  .use(readRateLimit)
  .handler(async (opts) => {
    const { caller } = opts.context;
    const visibility = resolveFeedVisibility(caller, opts.input);

    const data = await getInfiniteFeedsByUserId(opts.context.db, {
      type: opts.input.type,
      limit: resolveFeedLimit(caller.tier, opts.input.limit),
      orderBy: opts.input.orderBy,
      sortOrder: opts.input.sortOrder,
      cursor: opts.input.nextCursor,
      withContent: opts.input.withContent,
      locale: opts.input.locale,
      ...toFeedListScope(visibility),
    });

    if (!data) {
      throw opts.errors.NOT_FOUND();
    }

    return data;
  });

export const getFeedBySlugRoute = contractOS.feeds["details-by-slug"]
  .use(keyedReadGuard)
  .use(readRateLimit)
  .handler(async (opts) => {
    const visibility = resolveFeedVisibility(opts.context.caller, opts.input);

    const feed = await getFeedBySlug(opts.context.db, {
      slug: opts.input.slug,
      locale: opts.input.locale,
      ...toFeedDetailScope(visibility),
    });

    if (!feed) {
      throw opts.errors.NOT_FOUND();
    }

    return feed;
  });

export const getFeedByIdRoute = contractOS.feeds["details-by-id"]
  .use(sessionReadGuard)
  .use(readRateLimit)
  .handler(async (opts) => {
    const visibility = resolveFeedVisibility(opts.context.caller, opts.input);

    const feed = await getFeedById(opts.context.db, {
      feedId: opts.input.feedId,
      locale: opts.input.locale,
      ...toFeedDetailScope(visibility),
    });

    if (!feed) {
      throw opts.errors.NOT_FOUND();
    }

    return feed;
  });

export const getRelatedFeedsRoute = contractOS.feeds.related
  .use(keyedReadGuard)
  .use(readRateLimit)
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
// Search
// ============================================

export const searchFeedsRoute = contractOS.feeds.search
  .use(publicReadGuard)
  .use(readRateLimit)
  .handler(async (opts) => {
    const items = await searchPublicFeedsService({
      db: opts.context.db,
      keyword: opts.input.keyword,
      locale: opts.input.locale,
      limit: opts.input.limit,
    });

    return { items };
  });

export const searchFeedsAdvancedRoute = contractOS.feeds["search:advanced"]
  /**
   * Authenticated for every mode, and root-only for the modes that embed the query —
   * those spend the server's embedding credentials, `bm25` does not.
   */
  .use(sessionGuard, (input) => ({ rootOnly: input.model !== "bm25" }))
  .handler(async (opts) => {
    const { keyword, model, locale } = opts.input;

    return await searchFeedsService({
      db: opts.context.db,
      keyword,
      model,
      locale,
    });
  });

// ============================================
// Writes
//
// `update`, `translation:upsert` and `content:upsert` sit at the API-key tier because the
// content pipeline drives them deployment-to-deployment; the rest require the operator's
// own session.
// ============================================

const contentWriteGuard = callerGuard({ minTier: CallerTier.ApiKey });
const rootWriteGuard = callerGuard({ minTier: CallerTier.Root });

export const createFeedRoute = contractOS.feeds.create
  .use(rootWriteGuard)
  .handler(async (opts) => {
    // The write logic lives in `feeds/write` because the writing agent's durable turn calls
    // it too, from a workflow step that has no request to authorise against.
    try {
      return await createFeedService(opts.context.db, {
        ...opts.input,
        adminId: opts.context.caller.adminId,
      });
    } catch (error) {
      throw isAppError(error) ? toORPCError(error) : error;
    }
  });

export const updateFeedRoute = contractOS.feeds.update
  .use(contentWriteGuard)
  .handler(async (opts) => {
    try {
      return await updateFeedService(opts.context.db, opts.input);
    } catch (error) {
      throw isAppError(error) ? toORPCError(error) : error;
    }
  });

export const deleteFeedRoute = contractOS.feeds.delete
  .use(rootWriteGuard)
  .handler(async (opts) => {
    const feed = await getFeedForIndexing(opts.context.db, {
      feedId: opts.input.feedId,
    });
    if (!feed) {
      throw opts.errors.NOT_FOUND();
    }

    if (opts.input.hard) {
      await deleteFeed(opts.context.db, { feedId: opts.input.feedId });
    } else {
      await softDeleteFeed(opts.context.db, { feedId: opts.input.feedId });
    }

    await feedEvents.removed(feed.translations.map(({ id }) => id));
  });

export const restoreFeedRoute = contractOS.feeds.restore
  .use(rootWriteGuard)
  .handler(async (opts) => {
    const data = await restoreFeed(opts.context.db, {
      feedId: opts.input.feedId,
    });
    if (!data) {
      throw opts.errors.NOT_FOUND();
    }
    await feedEvents.changed(data.id);
  });

export const upsertFeedTranslationRoute = contractOS.feeds["translation:upsert"]
  .use(contentWriteGuard)
  .handler(async (opts) => {
    const translation = await upsertFeedTranslation(
      opts.context.db,
      opts.input
    );

    if (translation) {
      await feedEvents.changed(translation.feedId);
    }
  });

export const upsertContentRoute = contractOS.feeds["content:upsert"]
  .use(contentWriteGuard)
  .handler(async (opts) => {
    /**
     * An `UPDATE` keyed on the translation id, so an unknown id matches no row and returns
     * nothing. Ignoring that answered 2xx to a write that never landed, which the content
     * pipeline had no way to notice.
     */
    const content = await upsertContent(opts.context.db, opts.input);

    if (!content) {
      throw opts.errors.NOT_FOUND();
    }

    const feedID = await getFeedIdByTranslationId(opts.context.db, {
      translationId: opts.input.feedTranslationId,
    });

    if (feedID) {
      await feedEvents.changed(feedID);
    }
  });
