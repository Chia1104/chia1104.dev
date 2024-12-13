import { createFactory } from "hono/factory";

import { createRedis } from "@chia/cache";
import { connectDatabase } from "@chia/db/client";

export default createFactory<HonoContext>({
  initApp: (app) => {
    app.use(async (c, next) => {
      c.set("db", await connectDatabase());
      c.set("redis", createRedis());
      await next();
    });
  },
});
