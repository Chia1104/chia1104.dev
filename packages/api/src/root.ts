import { createTRPCRouter } from "./trpc";
import { feedsRouter } from "./routes/feeds";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  feeds: feedsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
