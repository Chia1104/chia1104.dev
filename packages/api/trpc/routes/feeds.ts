import {
  eq,
  schema,
  getInfiniteFeeds,
  getInfiniteFeedsByUserId,
  getFeedBySlug,
  createFeed,
} from "@chia/db";
import {
  infiniteSchema,
  getPublicFeedBySlugSchema,
  insertFeedSchema,
  insertFeedContentSchema,
} from "@chia/db";

import { createTRPCRouter, protectedProcedure, adminProcedure } from "../trpc";

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
    .input(getPublicFeedBySlugSchema)
    .query(async (opts) => {
      return getFeedBySlug(opts.ctx.db, {
        slug: opts.input.slug,
        type: opts.input.type,
      });
    }),

  createPost: adminProcedure
    .input(
      insertFeedSchema
        .omit({ userId: true })
        .merge(insertFeedContentSchema("post").omit({ feedId: true }))
    )
    .mutation(async (opts) => {
      await createFeed(opts.ctx.db, {
        slug: opts.input.slug,
        type: "post",
        title: opts.input.title,
        description: opts.input.description,
        excerpt: opts.input.excerpt || opts.input.description?.slice(0, 100),
        userId: opts.ctx.adminId,
        published: opts.input.published ?? false,
        content: opts.input.content,
      });
    }),
});
