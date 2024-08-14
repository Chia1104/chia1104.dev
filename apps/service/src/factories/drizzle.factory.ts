import { createFactory } from "hono/factory";

import { getDB } from "@chia/db";

export default createFactory<HonoContext>({
  initApp: (app) => {
    app.use(async (c, next) => {
      c.set("db", getDB());
      await next();
    });
  },
});
