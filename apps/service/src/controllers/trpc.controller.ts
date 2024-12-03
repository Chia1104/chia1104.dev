import dayjs from "dayjs";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";

import { appRouter, createTRPCContext } from "@chia/api/trpc";
import { fetchRequestHandler } from "@chia/api/trpc/utils";
import type { Session } from "@chia/auth-core";
import { adapter } from "@chia/auth-core/adapter";
import { SESSION_TOKEN } from "@chia/auth-core/utils";

import { sessionAction } from "@/middlewares/auth.middleware";

const api = new Hono<HonoContext>();

api.use("*", async (c) => {
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

  const bodyProps = new Set([
    "arrayBuffer",
    "blob",
    "formData",
    "json",
    "text",
  ] as const);
  type BodyProp = typeof bodyProps extends Set<infer T> ? T : never;
  const canWithBody = c.req.method === "GET" || c.req.method === "HEAD";

  return fetchRequestHandler({
    endpoint: "/api/v1/trpc",
    router: appRouter,
    createContext: () => {
      return createTRPCContext({
        auth: session,
        db: c.var.db,
        redis: c.var.redis,
      });
    },
    onError: ({ error, path }) => {
      if (error.code == "INTERNAL_SERVER_ERROR") {
        c.get("sentry").captureException(error);
      }
      console.error(`>>> tRPC Error on '${path}'`, error);
    },
    req: canWithBody
      ? c.req.raw
      : new Proxy(c.req.raw, {
          get(t, p, _r) {
            if (bodyProps.has(p as BodyProp)) {
              return () => c.req[p as BodyProp]();
            }
            return Reflect.get(t, p, t);
          },
        }),
  }).then((res) => c.body(res.body, res));
});

export default api;
