import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { PostsAPI } from "@chia/db";

export const postRouter = createTRPCRouter({
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
        })
        .optional()
        .default({
          take: 10,
          skip: 0,
          orderBy: "updatedAt",
          sortOrder: "desc",
        })
    )
    .query(async (opts) => {
      return new PostsAPI(opts.ctx.db).getPosts(opts.input);
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
        })
        .optional()
        .default({
          limit: 10,
          cursor: null,
          orderBy: "updatedAt",
          sortOrder: "desc",
        })
    )
    .query(async (opts) => {
      return new PostsAPI(opts.ctx.db).getInfinitePosts(opts.input);
    }),
});
