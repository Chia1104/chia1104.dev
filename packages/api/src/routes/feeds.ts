import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "../trpc";
import { FeedsAPI } from "@chia/db";

export const feedsRouter = createTRPCRouter({
  get: publicProcedure
    .input(
      z
        .object({
          take: z.number().max(20).optional().default(10),
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
      return new FeedsAPI(opts.ctx.db).getFeeds(opts.input);
    }),

  infinite: publicProcedure
    .input(
      z
        .object({
          limit: z.number().max(20).optional().default(10),
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
      return new FeedsAPI(opts.ctx.db).getInfiniteFeeds(opts.input);
    }),

  getByAdmin: adminProcedure
    .input(
      z
        .object({
          take: z.number().max(20).optional().default(10),
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
      });
    }),

  infinityByAdmin: adminProcedure
    .input(
      z
        .object({
          limit: z.number().max(20).optional().default(10),
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
      });
    }),
});
