import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "../trpc";
import {
  eq,
  schema,
  getFeeds,
  getInfiniteFeeds,
  getFeedsByUserId,
  getInfiniteFeedsByUserId,
} from "@chia/db";
import { getSchema, infiniteSchema } from "@chia/db/src/utils/validator/feeds";

export const feedsRouter = createTRPCRouter({
  get: protectedProcedure.input(getSchema).query(async (opts) => {
    return getFeeds(opts.ctx.db, {
      ...opts.input,
      whereAnd: [eq(schema.feeds.userId, opts.ctx.session.user.id)],
    });
  }),

  infinite: protectedProcedure.input(infiniteSchema).query(async (opts) => {
    return getInfiniteFeeds(opts.ctx.db, {
      ...opts.input,
      whereAnd: [eq(schema.feeds.userId, opts.ctx.session.user.id)],
    });
  }),

  getByAdmin: adminProcedure.input(getSchema).query(async (opts) => {
    return getFeedsByUserId(opts.ctx.db, {
      ...opts.input,
      userId: opts.ctx.adminId,
      whereAnd: [eq(schema.feeds.published, true)],
    });
  }),

  infinityByAdmin: adminProcedure.input(infiniteSchema).query(async (opts) => {
    return getInfiniteFeedsByUserId(opts.ctx.db, {
      ...opts.input,
      userId: opts.ctx.adminId,
      whereAnd: [eq(schema.feeds.published, true)],
    });
  }),
});
