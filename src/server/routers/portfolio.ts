import { createRouter } from "@chia/server/createRouter";
import { z } from "zod";

export const portfolioRouter = createRouter()
  .mutation("add-design", {
    input: z.object({
      name: z.string().min(1).max(100),
      description: z.string().min(1).max(256).optional(),
      imageUrl: z.string().min(1),
    }),
    async resolve({ ctx, input }) {
      return await ctx.prisma.design.create({
        data: input,
      });
    },
  })
  .query("all-design", {
    async resolve({ ctx }) {
      return ctx.prisma.design.findMany({
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      });
    },
  });
