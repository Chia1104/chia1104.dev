import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import {
  HEADER_AUTH_TOKEN,
  OPENAI_API_KEY,
  ANTHROPIC_API_KEY,
  GOOGLE_API_KEY,
  DEEPSEEK_API_KEY,
} from "@chia/ai/constants";
import { Provider } from "@chia/ai/types";
import { verifyApiKey } from "@chia/ai/utils";
import { errorGenerator } from "@chia/utils";
import { tryCatch } from "@chia/utils/try-catch";

import { env } from "@/env";

export const AI_AUTH_TOKEN = "AI_AUTH_TOKEN";

const getApiKey = (c: Context, provider?: Provider) => {
  switch (provider) {
    case Provider.OpenAI:
      return (
        getCookie(c, OPENAI_API_KEY)?.toString() ??
        getCookie(c, HEADER_AUTH_TOKEN)?.toString()
      );
    case Provider.Anthropic:
      return getCookie(c, ANTHROPIC_API_KEY)?.toString();
    case Provider.Google:
      return getCookie(c, GOOGLE_API_KEY)?.toString();
    case Provider.DeepSeek:
      return getCookie(c, DEEPSEEK_API_KEY)?.toString();
    default:
      return getCookie(c, HEADER_AUTH_TOKEN)?.toString();
  }
};

export const ai = (provider?: Provider) =>
  createMiddleware(async (c, next) => {
    if (!env.AI_AUTH_PRIVATE_KEY) {
      return c.json(errorGenerator(503), 503, {
        "Retry-After": "3600",
      });
    }
    const { data: json } = await tryCatch(
      c.req.json<{ modal: { provider: Provider } }>()
    );
    const { data: authToken } = await tryCatch(
      getApiKey(c, provider ?? json?.modal?.provider)
    );
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
    const { data: apiKey, error } = await tryCatch(
      verifyApiKey(authToken, env.AI_AUTH_PRIVATE_KEY).apiKey
    );
    if (error) {
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
    c.set(AI_AUTH_TOKEN, apiKey);
    await next();
  });
