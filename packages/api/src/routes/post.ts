import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";

export const postRouter = createTRPCRouter({
  get: publicProcedure
    .input(
      z
        .object({
          take: z.number().max(20).optional().default(10),
          skip: z.number().optional().default(0),
          orderBy: z
            .enum(["createdAt", "updatedAt"])
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
      return await opts.ctx.db.post.findMany({
        take: opts.input.take,
        skip: opts.input.skip,
        orderBy: { [opts.input.orderBy]: opts.input.sortOrder },
      });
    }),

  infinite: publicProcedure
    .input(
      z
        .object({
          limit: z.number().max(20).optional().default(10),
          cursor: z.string().nullish(), // <-- "cursor" needs to exist, but can be any type
          orderBy: z
            .enum(["createdAt", "updatedAt"])
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
      const { input } = opts;
      const limit = input.limit;
      const { cursor, orderBy, sortOrder } = input;
      const items = await opts.ctx.db.post.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { [orderBy]: sortOrder },
      });
      let nextCursor: typeof cursor | undefined = undefined;
      let hasNextPage = true;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }
      if (items.length == 0) {
        hasNextPage = false;
      }
      return {
        items,
        hasNextPage,
        nextCursor,
      };
    }),

  getSecretMessage: protectedProcedure.query((opts) => {
    return `Hello ${opts.ctx.session.user.name}!`;
  }),
});
