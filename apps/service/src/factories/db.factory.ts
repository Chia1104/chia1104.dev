import { createFactory } from "hono/factory";

import { createRedis } from "@chia/cache";
import { getDB } from "@chia/db";

export default createFactory<HonoContext>({
  initApp: (app) => {
    app.use(async (c, next) => {
      c.set("db", getDB());
      c.set("redis", createRedis());
      await next();
    });
  },
});
