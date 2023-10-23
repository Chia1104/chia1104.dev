import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@chia/api";
import { createTRPCContext } from "@chia/api";

const handler = (req: Request) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    createContext: createTRPCContext,
    router: appRouter,
  });
};

export { handler as GET, handler as POST };
