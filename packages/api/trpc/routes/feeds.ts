import GithubSlugger from "github-slugger";
import { z } from "zod";

import {
  eq,
  schema,
  getInfiniteFeeds,
  getInfiniteFeedsByUserId,
  getFeedBySlug,
  getFeedById,
  createFeed,
  updateFeed,
  deleteFeed,
} from "@chia/db";
import { ContentType } from "@chia/db/types";
import { infiniteSchema } from "@chia/db/validator/feeds";

import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
  onlyAdminProcedure,
} from "../trpc";
import {
  createFeedSchema,
  updateFeedSchema,
  deleteFeedSchema,
} from "../validators";

const slugger = new GithubSlugger();

export const feedsRouter = createTRPCRouter({
  getFeedsWithMeta: protectedProcedure
    .input(infiniteSchema)
    .query(async (opts) => {
      return getInfiniteFeeds(opts.ctx.db, {
        ...opts.input,
        whereAnd: [eq(schema.feeds.userId, opts.ctx.session.user.id ?? "")],
      });
    }),

  getFeedsWithMetaByAdminId: adminProcedure
    .input(infiniteSchema)
    .query(async (opts) => {
      return getInfiniteFeedsByUserId(opts.ctx.db, {
        ...opts.input,
        userId: opts.ctx.adminId,
        whereAnd: [eq(schema.feeds.published, true)],
      });
    }),

  getFeedBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async (opts) => {
      return getFeedBySlug(opts.ctx.db, opts.input.slug);
    }),

  getFeedById: protectedProcedure
    .input(z.object({ feedId: z.number() }))
    .query((opts) => {
      return getFeedById(opts.ctx.db, opts.input.feedId);
    }),

  createFeed: onlyAdminProcedure
    .input(createFeedSchema)
    .mutation(async (opts) => {
      await createFeed(opts.ctx.db, {
        slug: opts.input.slug
          ? slugger.slug(opts.input.slug)
          : slugger.slug(
              `${opts.input.title}-${crypto
                .getRandomValues(new Uint32Array(1))[0]
                .toString(16)}`
            ),
        type: opts.input.type,
        title: opts.input.title,
        description: opts.input.description,
        excerpt: opts.input.excerpt || opts.input.description?.slice(0, 100),
        userId: opts.ctx.adminId,
        published: opts.input.published ?? false,
        content: opts.input.content,
        source: opts.input.source,
        unstable_serializedSource: opts.input.unstable_serializedSource,
        contentType: opts.input.contentType ?? ContentType.Mdx,
        createdAt: opts.input.createdAt,
        updatedAt: opts.input.updatedAt,
      });
    }),

  updateFeed: onlyAdminProcedure
    .input(updateFeedSchema)
    .mutation(async (opts) => {
      await updateFeed(opts.ctx.db, {
        feedId: opts.input.feedId,
        // slug: opts.input.slug ? slugger.slug(opts.input.slug) : undefined,
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
    }),

  deleteFeed: onlyAdminProcedure
    .input(deleteFeedSchema)
    .mutation(async (opts) => {
      await deleteFeed(opts.ctx.db, {
        feedId: opts.input.feedId,
      });
    }),
});
