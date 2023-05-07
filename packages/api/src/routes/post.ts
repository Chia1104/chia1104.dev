import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";

export const postRouter = createTRPCRouter({
  hello: publicProcedure.input(z.object({ text: z.string() })).query((opts) => {
    return {
      greeting: `Hello ${opts.input.text}`,
    };
  }),

  getAll: publicProcedure.query(async (opts) => {
    const startTime = Date.now();
    const items = await opts.ctx.db.post.findMany({
      take: 10,
      orderBy: { updatedAt: "desc" },
    });
    const duration = Date.now() - startTime;

    return { items, duration, fetchedAt: new Date(startTime) };
  }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
