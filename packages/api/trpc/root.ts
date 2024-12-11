// external
import { feedsRouter as external_feedsRouter } from "./routes/external/feeds";
import { feedsRouter } from "./routes/feeds";
import { usersRouter } from "./routes/users";
import { createTRPCRouter, external_createTRPCRouter } from "./trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  feeds: feedsRouter,
  users: usersRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

export const externalRouter = external_createTRPCRouter({
  feeds: external_feedsRouter,
});

export type ExternalRouter = typeof externalRouter;
