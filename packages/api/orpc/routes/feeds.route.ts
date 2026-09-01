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
import { withORPCErrors } from "@chia/service-kit/adapters/orpc";
import { CallerTier } from "@chia/service-kit/policies/caller.policy";

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
import { sessionGuard } from "../guards/auth.guard";
import { callerGuard, tieredRateLimitGuard } from "../guards/caller.guard";
import { contractOS } from "../utils";

// `publicReadGuard` has no floor: a browser never holds the project API key.
// `keyedReadGuard` is www's server client with `x-ch-api-key`.
// `sessionReadGuard` is dash with a session cookie. Rate limit scales with the same tier.

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
   * Authenticated for every mode; root-only for modes that embed the query. Those spend
   * the server's embedding credentials; `bm25` does not.
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

// `update`, `translation:upsert` and `content:upsert` sit at API-key because the
// content pipeline drives them; the rest require the operator's session.

const contentWriteGuard = callerGuard({ minTier: CallerTier.ApiKey });
const rootWriteGuard = callerGuard({ minTier: CallerTier.Root });

export const createFeedRoute = contractOS.feeds.create
  .use(rootWriteGuard)
  .handler((opts) =>
    withORPCErrors(() =>
      createFeedService(
        opts.context.db,
        { ...opts.input, adminId: opts.context.caller.adminId },
        opts.context.hooks ?? {}
      )
    )
  );

export const updateFeedRoute = contractOS.feeds.update
  .use(contentWriteGuard)
  .handler((opts) =>
    withORPCErrors(() =>
      updateFeedService(opts.context.db, opts.input, opts.context.hooks ?? {})
    )
  );

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

    await opts.context.hooks?.onFeedRemoved?.(
      feed.translations.map(({ id }) => id)
    );
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
    await opts.context.hooks?.onFeedChanged?.(data.id);
  });

export const upsertFeedTranslationRoute = contractOS.feeds["translation:upsert"]
  .use(contentWriteGuard)
  .handler(async (opts) => {
    const translation = await upsertFeedTranslation(
      opts.context.db,
      opts.input
    );

    if (translation) {
      await opts.context.hooks?.onFeedChanged?.(translation.feedId);
    }
  });

export const upsertContentRoute = contractOS.feeds["content:upsert"]
  .use(contentWriteGuard)
  .handler(async (opts) => {
    // `UPDATE` keyed on translation id: an unknown id matches no row. Ignoring that answered 2xx to a write that never landed.
    const content = await upsertContent(opts.context.db, opts.input);

    if (!content) {
      throw opts.errors.NOT_FOUND();
    }

    const feedID = await getFeedIdByTranslationId(opts.context.db, {
      translationId: opts.input.feedTranslationId,
    });

    if (feedID) {
      await opts.context.hooks?.onFeedChanged?.(feedID);
    }
  });
