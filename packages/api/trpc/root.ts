// external
import { apiKeyRouter } from "./routes/apikey";
import { feedsRouter } from "./routes/feeds";
import { organizationRouter } from "./routes/organization";
import { usersRouter } from "./routes/users";
import { createTRPCRouter } from "./trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  feeds: feedsRouter,
  users: usersRouter,
  organization: organizationRouter,
  apiKey: apiKeyRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
