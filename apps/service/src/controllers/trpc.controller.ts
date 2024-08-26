import { getAuthUser } from "@hono/auth-js";
import { Hono } from "hono";

import { appRouter, createTRPCContext } from "@chia/api/trpc";
import { fetchRequestHandler } from "@chia/api/trpc/utils";

const api = new Hono<HonoContext>();

api.use("*", async (c) =>
  fetchRequestHandler({
    endpoint: "/trpc",
    router: appRouter,
    createContext: async () =>
      /**
       * TODO: remove getAuthUser()
       * (issue: https://github.com/honojs/middleware/issues/665)
       */
      createTRPCContext({ auth: (await getAuthUser(c))?.session }),
    onError: ({ error, path }) => {
      if (error.code == "INTERNAL_SERVER_ERROR") {
        c.get("sentry").captureException(error);
      }
      console.error(`>>> tRPC Error on '${path}'`, error);
    },
    req: c.req.raw,
  }).then((res) => c.body(res.body, res))
);

export default api;
