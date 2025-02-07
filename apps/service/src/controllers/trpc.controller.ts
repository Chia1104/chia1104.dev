import { Hono } from "hono";

import { appRouter, createTRPCContext } from "@chia/api/trpc";
import { fetchRequestHandler } from "@chia/api/trpc/utils";
import type { Session } from "@chia/auth/types";

const api = new Hono<HonoContext>();

api.use("*", async (c) => {
  const bodyProps = new Set([
    "arrayBuffer",
    "blob",
    "formData",
    "json",
    "text",
  ] as const);
  type BodyProp = typeof bodyProps extends Set<infer T> ? T : never;
  const canWithBody = c.req.method === "GET" || c.req.method === "HEAD";

  const userSession = c.get("session");
  const user = c.get("user");

  let session: Session | null = null;

  if (!userSession || !user) {
    session = null;
  } else {
    session = {
      user,
      session: userSession,
    };
  }

  return fetchRequestHandler({
    endpoint: "/api/v1/trpc",
    router: appRouter,
    createContext: () => {
      return createTRPCContext({
        session,
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
  }).then((res) => c.body(res.body ?? "No body provided", res));
});

export default api;
