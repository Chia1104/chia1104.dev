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
      createTRPCContext({ auth: (await getAuthUser(c))?.session }),
    onError: ({ error, path }) => {
      if (error.code == "INTERNAL_SERVER_ERROR") {
        c.get("sentry").captureException(error);
      }
      console.error(`>>> tRPC Error on '${path}'`, error);
    },
    // TODO
    // Bun issues (https://github.com/honojs/middleware/issues/81#issuecomment-1509457656)
    // `c.req.raw.clone().json()` does not work in the tRPC server (Bun did not implement `.clone().json()`)
    // and `c.req.raw` has multiple `body` calls
    // currently, mutation is not working
    req: c.req.raw,
  }).then((res) => c.body(res.body, res))
);

export default api;
