import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { desc, eq, schema, asc } from "@chia/db";

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
      return opts.ctx.db.query.feeds.findMany({
        orderBy:
          opts.input.sortOrder === "asc"
            ? asc(schema.feeds[opts.input.orderBy])
            : desc(schema.feeds[opts.input.orderBy]),
        limit: opts.input.take,
        offset: opts.input.skip,
        with: {
          posts: true,
        },
      });
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
      const { cursor, orderBy, sortOrder, limit } = opts.input;
      const items = await opts.ctx.db.query.feeds.findMany({
        orderBy:
          opts.input.sortOrder === "asc"
            ? asc(schema.feeds[opts.input.orderBy])
            : desc(schema.feeds[opts.input.orderBy]),
        limit: limit,
        with: {
          posts: true,
        },
        where: (feeds, { gt, lt }) =>
          sortOrder === "asc"
            ? lt(feeds[orderBy], cursor)
            : gt(feeds[orderBy], cursor),
      });
      let nextCursor: typeof cursor | undefined = undefined;
      let hasNextPage = true;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }
      if (items.length == 0 || nextCursor == null) {
        hasNextPage = false;
      }
      return {
        items,
        hasNextPage,
        nextCursor,
      };
    }),
});
