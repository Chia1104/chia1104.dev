import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";

import { router } from "@chia/api/orpc/router";

const api = new Hono<HonoContext>();
const handler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

api.use("/*", async (c, next) => {
  const { matched, response } = await handler.handle(c.req.raw, {
    prefix: "/api/v1/rpc",
    context: {
      headers: c.req.raw.headers,
      db: c.var.db,
      redis: c.var.redis,
    },
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

export default api;
