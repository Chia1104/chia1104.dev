import { createFactory } from "hono/factory";

import { createRedis } from "@chia/cache";
import { connectDatabase } from "@chia/db/client";
import { errorGenerator } from "@chia/utils";
import { getClientIP } from "@chia/utils/get-client-ip";
import { tryCatch } from "@chia/utils/try-catch";

export default createFactory<HonoContext>({
  initApp: (app) => {
    app.use(async (c, next) => {
      const { data: db, error: dbError } = await tryCatch(connectDatabase());
      const { data: redis, error: redisError } = await tryCatch(createRedis());

      if (dbError || redisError) {
        console.error(dbError, redisError);
        return c.json(errorGenerator(503));
      }

      c.set("clientIP", getClientIP(c.req.raw) as string);
      c.set("db", db);
      c.set("redis", redis);
      await next();
    });
  },
});
