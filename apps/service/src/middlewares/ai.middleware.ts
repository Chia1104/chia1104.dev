import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import { HEADER_AUTH_TOKEN } from "@chia/ai/constants";
import { verifyApiKey } from "@chia/ai/utils";
import { errorGenerator } from "@chia/utils";

import { env } from "@/env";

export const AI_AUTH_TOKEN = "AI_AUTH_TOKEN";

export const ai = () =>
  createMiddleware(async (c, next) => {
    if (!env.AI_AUTH_SECRET || !env.OPENAI_API_KEY) {
      return c.json(errorGenerator(503), 503, {
        "Retry-After": "3600",
      });
    }
    const authToken =
      c.req.raw.headers.get(HEADER_AUTH_TOKEN) ??
      getCookie(c, HEADER_AUTH_TOKEN)?.toString();
    if (!authToken) {
      return c.json(
        errorGenerator(401, [
          {
            field: "api_key",
            message: "Missing or invalid API key",
          },
        ]),
        401
      );
    }
    c.set(AI_AUTH_TOKEN, verifyApiKey(authToken, env.AI_AUTH_SECRET).apiKey);
    await next();
  });
