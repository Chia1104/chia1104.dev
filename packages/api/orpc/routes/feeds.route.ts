import {
  getInfiniteFeeds,
  getFeedBySlug,
  getFeedById,
  getFeedForIndexing,
  softDeleteFeed,
  restoreFeed,
  deleteFeed,
} from "@chia/db/repos/feeds";
import { toORPCError } from "@chia/service-kit/adapters/orpc";
import { isAppError } from "@chia/service-kit/errors";

import { createFeedService, updateFeedService } from "../../feeds/write";
import { feedEvents } from "../events";
import { adminGuard } from "../guards/admin.guard";
import { authGuard } from "../guards/auth.guard";
import { contractOS } from "../utils";

export const getFeedsWithMetaRoute = contractOS.feeds.list
  .use(authGuard)
  .handler(async (opts) => {
    const data = await getInfiniteFeeds(opts.context.db, {
      ...opts.input,
      enableDeleted: true,
      whereAnd: { userId: opts.context.session.user.id ?? "" },
    });
    if (!data) {
      throw opts.errors.NOT_FOUND();
    }
    return data;
  });

export const getFeedBySlugRoute = contractOS.feeds["details-by-slug"]
  .use(authGuard)
  .handler(async (opts) => {
    const data = await getFeedBySlug(opts.context.db, {
      slug: opts.input.slug,
      locale: opts.input.locale,
      enableDeleted: true,
    });
    if (!data) {
      throw opts.errors.NOT_FOUND();
    }
    return data;
  });

export const getFeedByIdRoute = contractOS.feeds["details-by-id"]
  .use(authGuard)
  .handler(async (opts) => {
    const data = await getFeedById(opts.context.db, {
      feedId: opts.input.feedId,
      locale: opts.input.locale,
      enableDeleted: true,
    });
    if (!data) {
      throw opts.errors.NOT_FOUND();
    }
    return data;
  });

export const createFeedRoute = contractOS.feeds.create
  .use(adminGuard())
  .handler(async (opts) => {
    // The write logic lives in `services/feeds` because the writing agent's durable turn calls
    // it too, from a workflow step that has no request to authorise against.
    try {
      return await createFeedService(opts.context.db, {
        ...opts.input,
        adminId: opts.context.adminId,
      });
    } catch (error) {
      throw isAppError(error) ? toORPCError(error) : error;
    }
  });

export const updateFeedRoute = contractOS.feeds.update
  .use(adminGuard())
  .handler(async (opts) => {
    try {
      return await updateFeedService(opts.context.db, opts.input);
    } catch (error) {
      throw isAppError(error) ? toORPCError(error) : error;
    }
  });

export const deleteFeedRoute = contractOS.feeds.delete
  .use(adminGuard())
  .handler(async (opts) => {
    const feed = await getFeedForIndexing(opts.context.db, {
      feedId: opts.input.feedId,
    });
    if (!feed) {
      throw opts.errors.NOT_FOUND();
    }

    if (opts.input.hard) {
      await deleteFeed(opts.context.db, {
        feedId: opts.input.feedId,
      });
    } else {
      await softDeleteFeed(opts.context.db, {
        feedId: opts.input.feedId,
      });
    }

    await feedEvents.removed(feed.translations.map(({ id }) => id));
  });

export const restoreFeedRoute = contractOS.feeds.restore
  .use(adminGuard())
  .handler(async (opts) => {
    const data = await restoreFeed(opts.context.db, {
      feedId: opts.input.feedId,
    });
    if (!data) {
      throw opts.errors.NOT_FOUND();
    }
    await feedEvents.changed(data.id);
  });
