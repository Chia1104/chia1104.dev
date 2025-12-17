import { createFactory } from "hono/factory";

import { connectDatabase } from "@chia/db/client";
import { kv } from "@chia/kv";
import { tryCatch } from "@chia/utils/error-helper";
import { errorGenerator } from "@chia/utils/server";
import { getClientIP } from "@chia/utils/server";

export default createFactory<HonoContext>({
  initApp: (app) => {
    app.use(async (c, next) => {
      const { data: db, error: dbError } = await tryCatch(connectDatabase());

      if (dbError) {
        console.error(dbError);
        return c.json(errorGenerator(503));
      }

      c.set("clientIP", getClientIP(c.req.raw));
      c.set("db", db);
      c.set("redis", kv);
      await next();
    });
  },
});
