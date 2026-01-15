import { createFactory } from "hono/factory";

import { connectDatabase } from "@chia/db/client";
import { tryCatch } from "@chia/utils/error-helper";
import { errorGenerator } from "@chia/utils/server";
import { getClientIP } from "@chia/utils/server";

export default createFactory<HonoContext>({
  initApp: (app) => {
    app.use(async (c, next) => {
      const [{ data: db, error: dbError }, { data: kv, error: kvError }] =
        await Promise.all([
          tryCatch(connectDatabase()),
          tryCatch(import("@chia/kv").then((m) => m.kv)),
        ]);

      if (dbError || kvError) {
        console.error(dbError, kvError);
        return c.json(errorGenerator(503));
      }

      c.set("clientIP", getClientIP(c.req.raw));
      c.set("db", db);
      c.set("kv", kv);

      await next();
    });
  },
});
