import { getRuntimeKey } from "hono/adapter";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { auth } from "@chia/auth";
import { errorGenerator, getAdminId } from "@chia/utils";

export const verifyAuth = (adminOnly?: boolean) =>
  createMiddleware<HonoContext>(async (c, next) => {
    if (getRuntimeKey() === "bun") {
      Bun.gc(true);
    }
    try {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session) {
        return c.json(errorGenerator(401), 401);
      }

      if (adminOnly && session.user.id !== getAdminId()) {
        return c.json(errorGenerator(403), 403);
      }

      await next();
    } catch (error) {
      console.error(error);
      throw new HTTPException(500, {
        message: "Internal Server Error",
      });
    }
  });
