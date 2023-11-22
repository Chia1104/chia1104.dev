import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createTRPCContext } from "@chia/api";
import { auth } from "@chia/auth";

const handler = auth(async (req) => {
  return await fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req,
    createContext: () => createTRPCContext({ auth: req.auth, req }),
    onError({ error, path }) {
      console.error(`>>> tRPC Error on '${path}'`, error);
    },
  });
});

export { handler as GET, handler as POST };
