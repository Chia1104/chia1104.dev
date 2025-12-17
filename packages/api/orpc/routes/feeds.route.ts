import { eq } from "drizzle-orm";
import crypto from "node:crypto";

import { schema } from "@chia/db";
import {
  getInfiniteFeeds,
  getInfiniteFeedsByUserId,
  getFeedBySlug,
  getFeedById,
  createFeed,
  updateFeed,
  deleteFeed,
} from "@chia/db/repos/feeds";
import { ContentType } from "@chia/db/types";

import { adminGuard } from "../guards/admin.guard";
import { authGuard } from "../guards/auth.guard";
import { contractOS, slugger } from "../utils";

export const getFeedsWithMetaRoute = contractOS.feeds.list
  .use(authGuard)
  .handler(async (opts) => {
    const data = await getInfiniteFeeds(opts.context.db, {
      ...opts.input,
      whereAnd: [eq(schema.feeds.userId, opts.context.session.user.id ?? "")],
    });
    if (!data) {
      throw opts.errors.NOT_FOUND();
    }
    return data;
  });

export const getFeedsWithMetaByAdminIdRoute = contractOS.feeds["admin-list"]
  .use(
    adminGuard({
      enabled: false,
    })
  )
  .handler(async (opts) => {
    const data = await getInfiniteFeedsByUserId(opts.context.db, {
      ...opts.input,
      userId: opts.context.adminId,
      whereAnd: [eq(schema.feeds.published, true)],
    });
    if (!data) {
      throw opts.errors.NOT_FOUND();
    }
    return data;
  });

export const getFeedBySlugRoute = contractOS.feeds["details-by-slug"]
  .use(authGuard)
  .handler(async (opts) => {
    const data = await getFeedBySlug(opts.context.db, opts.input.slug);
    if (!data) {
      throw opts.errors.NOT_FOUND();
    }
    return data;
  });

export const getFeedByIdRoute = contractOS.feeds["details-by-id"]
  .use(authGuard)
  .handler(async (opts) => {
    const data = await getFeedById(opts.context.db, opts.input.feedId);
    if (!data) {
      throw opts.errors.NOT_FOUND();
    }
    return data;
  });

export const createFeedRoute = contractOS.feeds.create
  .use(adminGuard())
  .handler(async (opts) => {
    const data = await createFeed(opts.context.db, {
      slug: opts.input.slug
        ? slugger.slug(opts.input.slug)
        : slugger.slug(
            `${opts.input.title}-${crypto.getRandomValues(new Uint32Array(1))[0]?.toString(16)}`
          ),
      type: opts.input.type,
      title: opts.input.title,
      description: opts.input.description,
      excerpt: opts.input.excerpt || opts.input.description?.slice(0, 100),
      userId: opts.context.adminId,
      published: opts.input.published ?? false,
      content: opts.input.content,
      source: opts.input.source,
      unstable_serializedSource: opts.input.unstable_serializedSource,
      contentType: opts.input.contentType ?? ContentType.Mdx,
      createdAt: opts.input.createdAt,
      updatedAt: opts.input.updatedAt,
    });
    if (opts.context.hooks?.onFeedCreated && data) {
      await opts.context.hooks.onFeedCreated(data);
    }
    return data;
  });

export const updateFeedRoute = contractOS.feeds.update
  .use(adminGuard())
  .handler(async (opts) => {
    const data = await updateFeed(opts.context.db, {
      feedId: opts.input.feedId,
      type: opts.input.type,
      title: opts.input.title,
      description: opts.input.description,
      excerpt: opts.input.excerpt || opts.input.description?.slice(0, 100),
      published: opts.input.published,
      content: opts.input.content,
      source: opts.input.source,
      unstable_serializedSource: opts.input.unstable_serializedSource,
      contentType: opts.input.contentType ?? undefined,
      createdAt: opts.input.createdAt,
      updatedAt: opts.input.updatedAt,
    });
    if (opts.context.hooks?.onFeedUpdated && data) {
      await opts.context.hooks.onFeedUpdated(data);
    }
    return data;
  });

export const deleteFeedRoute = contractOS.feeds.delete
  .use(adminGuard())
  .handler(async (opts) => {
    await deleteFeed(opts.context.db, {
      feedId: opts.input.feedId,
    });
  });
