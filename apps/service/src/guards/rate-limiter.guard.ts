import { rateLimiter } from "hono-rate-limiter";
import { createMiddleware } from "hono/factory";

import { getClientIP } from "@chia/utils/server";

import { env } from "@/env";

export const rateLimiterGuard = (options?: {
  windowMs?: number;
  limit?: number;
  standardHeaders?: "draft-6" | "draft-7";
  prefix?: string;
}) =>
  createMiddleware<HonoContext>(async (c, next) => {
    const {
      windowMs,
      limit,
      standardHeaders,
      prefix = "rate-limiter:root-request",
    } = options ?? {};
    return rateLimiter<HonoContext>({
      windowMs: windowMs ?? env.RATELIMIT_WINDOW_MS,
      limit: limit ?? env.RATELIMIT_MAX,
      standardHeaders: standardHeaders ?? "draft-6", // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
      keyGenerator: (c) => {
        let info: string | null | undefined = null;
        try {
          info = getClientIP(c.req.raw);
        } catch (e) {
          console.error(e);
          info = null;
        }
        const key = `${prefix}:ip-${info}`;
        console.log(key);
        return key;
      },
      store: {
        increment: async (key) => {
          const prev = await c.var.kv.get(key);
          const updatedVal = prev + 1;

          c.var.kv
            .set(key, updatedVal)
            .then(() => Promise.resolve(updatedVal))
            .catch((err: Error) => Promise.reject(err));

          return {
            totalHits: updatedVal,
          };
        },
        decrement: async (key) => {
          const prev = await c.var.kv.get(key);
          const updatedVal = prev - 1;

          c.var.kv
            .set(key, updatedVal)
            .then(() => Promise.resolve(updatedVal))
            .catch((err: Error) => Promise.reject(err));
        },
        resetKey: (key) => {
          c.var.kv
            .delete(key)
            .then(() => Promise.resolve())
            .catch((err: Error) => Promise.reject(err));
        },
      },
    })(c, next);
  });
