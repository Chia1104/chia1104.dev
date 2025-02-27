import { createFactory } from "hono/factory";

import { createRedis } from "@chia/cache";
import { connectDatabase } from "@chia/db/client";
import { errorGenerator } from "@chia/utils";
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

      c.set("db", db);
      c.set("redis", redis);
      await next();
    });
  },
});
