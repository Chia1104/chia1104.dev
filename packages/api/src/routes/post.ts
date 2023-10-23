import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { generateSlug } from "@chia/utils";

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
      const { cursor, orderBy, sortOrder, limit } = opts.input;
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
      if (items.length == 0 || nextCursor == null) {
        hasNextPage = false;
      }
      return {
        items,
        hasNextPage,
        nextCursor,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().optional().default("Untitled"),
        excerpt: z.string().optional().default(""),
        tags: z.array(z.string()).optional().default([]),
        headImg: z.string().optional(),
        published: z.boolean().optional().default(false),
        content: z.string().optional().default(""),
      })
    )
    .mutation(async (opts) => {
      const { title, excerpt, tags, headImg, published, content } = opts.input;
      const userId = opts.ctx.session.user.id;
      return await opts.ctx.db.post.create({
        data: {
          title,
          slug: generateSlug(title),
          excerpt,
          tags,
          headImg,
          published,
          content,
          userId,
        },
      });
    }),
});
