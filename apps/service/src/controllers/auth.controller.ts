import { Hono } from "hono";

import { auth } from "@chia/auth-core";

const api = new Hono<HonoContext>();

api.on(["GET", "POST"], "*", (c) => {
  return auth.handler(c.req.raw);
});

export default api;
