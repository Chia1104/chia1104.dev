import { getRuntimeKey } from "hono/adapter";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { auth } from "@chia/auth";
import { Role } from "@chia/db/types";
import { errorGenerator } from "@chia/utils";

export const verifyAuth = (rootOnly?: boolean) =>
  createMiddleware<HonoContext>(async (c, next) => {
    if (getRuntimeKey() === "bun") {
      Bun.gc(true);
    }
    try {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session) {
        return c.json(errorGenerator(401), 401);
      }

      if (rootOnly && session.user.role === Role.Root) {
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
