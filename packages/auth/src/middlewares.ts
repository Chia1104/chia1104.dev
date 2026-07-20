import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { Role } from "@chia/db/types";
import { decodeTrustedHeader, X_CH_AUTH_SESSION } from "@chia/utils/gateway";
import { errorGenerator } from "@chia/utils/server";

import type { AuthGateway } from "./gateway";
import type { Session } from "./types";

/**
 * The context slice `verifyAuth` relies on: an optional auth gateway for the
 * fallback path, and the `user` variable it sets on success. Service apps'
 * contexts structurally satisfy this.
 */
export interface VerifyAuthEnv {
  Variables: {
    auth?: AuthGateway;
    user: Session["user"];
  };
}

export const verifyAuth = <TEnv extends VerifyAuthEnv = VerifyAuthEnv>(
  rootOnly?: boolean | ((c: Context<TEnv>) => boolean | Promise<boolean>)
) =>
  createMiddleware<TEnv>(async (c, next) => {
    try {
      // fast path: identity injected by the edge gateway's forward_auth;
      // fall back to the auth gateway when not fronted by the edge (local dev,
      // internal callers)
      const session =
        decodeTrustedHeader<Session>(
          c.req.raw.headers.get(X_CH_AUTH_SESSION)
        ) ??
        (await c.var.auth?.api.getSession({
          headers: c.req.raw.headers,
        }));

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
