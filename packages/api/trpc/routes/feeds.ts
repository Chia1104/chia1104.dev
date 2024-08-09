import {
  eq,
  schema,
  getInfiniteFeeds,
  getInfiniteFeedsByUserId,
  getFeedBySlug,
} from "@chia/db";
import {
  infiniteSchema,
  getPublicFeedBySlugSchema,
} from "@chia/db/src/utils/validator/feeds";

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
});
