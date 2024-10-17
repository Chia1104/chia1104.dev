import dayjs from "dayjs";
import { Hono } from "hono";
import { getRuntimeKey } from "hono/adapter";
import { getCookie } from "hono/cookie";

import { appRouter, createTRPCContext } from "@chia/api/trpc";
import { fetchRequestHandler } from "@chia/api/trpc/utils";
import type { Session } from "@chia/auth-core";
import { adapter } from "@chia/auth-core/adapter";
import { SESSION_TOKEN } from "@chia/auth-core/utils";

import { sessionAction } from "@/middlewares/auth.middleware";

const api = new Hono<HonoContext>();

api.use("*", async (c) => {
  if (getRuntimeKey() === "bun") {
    Bun.gc(true);
  }
  return fetchRequestHandler({
    endpoint: "/api/v1/trpc",
    router: appRouter,
    createContext: async () => {
      const { getSessionAndUser, deleteSession, updateSession } = adapter({
        db: c.var.db,
        redis: c.var.redis,
      });
      let session: Session | null = null;
      const sessionToken = getCookie(c, SESSION_TOKEN);
      if (!sessionToken) {
        session = null;
      } else {
        const sessionAndUser = await sessionAction({
          c,
          sessionToken,
          getSessionAndUser,
          deleteSession,
          updateSession,
        });
        session = sessionAndUser
          ? {
              user: sessionAndUser.user,
              expires: dayjs(sessionAndUser.session.expires).toISOString(),
            }
          : null;
      }
      return createTRPCContext({ auth: session });
    },
    onError: ({ error, path }) => {
      if (error.code == "INTERNAL_SERVER_ERROR") {
        c.get("sentry").captureException(error);
      }
      console.error(`>>> tRPC Error on '${path}'`, error);
    },
    req: c.req.raw,
  }).then((res) => c.body(res.body, res));
});

export default api;
