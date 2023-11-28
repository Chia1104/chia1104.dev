import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "../trpc";
import { FeedsAPI, eq, schema } from "@chia/db";

export const feedsRouter = createTRPCRouter({
  get: protectedProcedure
    .input(
      z
        .object({
          take: z.number().max(50).optional().default(10),
          skip: z.number().optional().default(0),
          orderBy: z
            .enum(["createdAt", "updatedAt", "id", "slug", "title"])
            .optional()
            .default("updatedAt"),
          sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
          type: z.enum(["post", "note"]).optional().default("post"),
        })
        .optional()
        .default({
          take: 10,
          skip: 0,
          orderBy: "updatedAt",
          sortOrder: "desc",
          type: "post",
        })
    )
    .query(async (opts) => {
      return new FeedsAPI(opts.ctx.db).getFeeds({
        ...opts.input,
        whereAnd: [eq(schema.feeds.userId, opts.ctx.session.user.id)],
      });
    }),

  infinite: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().max(50).optional().default(10),
          cursor: z.any(),
          orderBy: z
            .enum(["createdAt", "updatedAt", "id", "slug", "title"])
            .optional()
            .default("updatedAt"),
          sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
          type: z.enum(["post", "note"]).optional().default("post"),
        })
        .optional()
        .default({
          limit: 10,
          cursor: null,
          orderBy: "updatedAt",
          sortOrder: "desc",
          type: "post",
        })
    )
    .query(async (opts) => {
      return new FeedsAPI(opts.ctx.db).getInfiniteFeeds({
        ...opts.input,
        whereAnd: [eq(schema.feeds.userId, opts.ctx.session.user.id)],
      });
    }),

  getByAdmin: adminProcedure
    .input(
      z
        .object({
          take: z.number().optional().default(10),
          skip: z.number().optional().default(0),
          orderBy: z
            .enum(["createdAt", "updatedAt", "id", "slug", "title"])
            .optional()
            .default("updatedAt"),
          sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
          type: z.enum(["post", "note"]).optional().default("post"),
        })
        .optional()
        .default({
          take: 10,
          skip: 0,
          orderBy: "updatedAt",
          sortOrder: "desc",
          type: "post",
        })
    )
    .query(async (opts) => {
      return new FeedsAPI(opts.ctx.db).getFeedsByUserId({
        ...opts.input,
        userId: opts.ctx.adminId,
        whereAnd: [eq(schema.feeds.published, true)],
      });
    }),

  infinityByAdmin: adminProcedure
    .input(
      z
        .object({
          limit: z.number().optional().default(10),
          cursor: z.any(),
          orderBy: z
            .enum(["createdAt", "updatedAt", "id", "slug", "title"])
            .optional()
            .default("updatedAt"),
          sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
          type: z.enum(["post", "note"]).optional().default("post"),
        })
        .optional()
        .default({
          limit: 10,
          cursor: null,
          orderBy: "updatedAt",
          sortOrder: "desc",
          type: "post",
        })
    )
    .query(async (opts) => {
      return new FeedsAPI(opts.ctx.db).getInfiniteFeedsByUserId({
        ...opts.input,
        userId: opts.ctx.adminId,
        whereAnd: [eq(schema.feeds.published, true)],
      });
    }),
});
