import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@chia/api";
import { createTRPCContext } from "@chia/api";
import { NextRequest } from "next/server";

const handler = (req: NextRequest) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    createContext: () => createTRPCContext({ req }),
    router: appRouter,
  });
};

export { handler as GET, handler as POST };
