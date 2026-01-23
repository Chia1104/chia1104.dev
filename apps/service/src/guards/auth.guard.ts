import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import type { Session } from "@chia/auth/types";
import { Role } from "@chia/db/types";
import { errorGenerator } from "@chia/utils/server";

export const verifyAuth = (
  rootOnly?:
    | boolean
    | ((
        c: Context<
          HonoContext<undefined, { user: Session["user"] } & Variables>
        >
      ) => boolean | Promise<boolean>)
) =>
  createMiddleware<
    HonoContext<undefined, { user: Session["user"] } & Variables>
  >(async (c, next) => {
    try {
      const session = await c.var.auth.api.getSession({
        headers: c.req.raw.headers,
      });
      if (!session) {
        return c.json(errorGenerator(401), 401);
      }

      if (
        rootOnly &&
        (typeof rootOnly === "function"
          ? (await rootOnly(c)) && session.user.role !== Role.Root
          : session.user.role !== Role.Root && rootOnly)
      ) {
        return c.json(errorGenerator(403), 403);
      }

      c.set("user", session.user);

      await next();
    } catch (error) {
      console.error(error);
      throw new HTTPException(500, {
        message: "Internal Server Error",
      });
    }
  });
