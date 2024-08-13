import { getAuthUser } from "@hono/auth-js";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";

import { appRouter, createTRPCContext } from "@chia/api/trpc";

const api = new Hono<HonoContext>();

api.use(
  "*",
  trpcServer({
    router: appRouter,
    createContext: async (_opts, c) => {
      const auth = await getAuthUser(c);
      return createTRPCContext({ auth: auth?.session });
    },
  })
);

export default api;
