import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { timeout } from "hono/timeout";
import * as z from "zod";

import {
  OPENAI_API_KEY,
  ANTHROPIC_API_KEY,
  GENAI_API_KEY,
  DEEPSEEK_API_KEY,
} from "@chia/ai/constants";
import { streamGeneratedText } from "@chia/ai/generate/utils";
import { baseRequestSchema } from "@chia/ai/types";
import { Provider } from "@chia/ai/types";
import { encodeApiKey } from "@chia/ai/utils";
import { getCookieDomain } from "@chia/auth/utils";
import { errorGenerator } from "@chia/utils/server";

import { env } from "@/env";
import { ai, AI_AUTH_TOKEN } from "@/guards/ai.guard";
import { verifyAuth } from "@/guards/auth.guard";
import { rateLimiterGuard } from "@/guards/rate-limiter.guard";
import { errorResponse } from "@/utils/error.util";

const api = new Hono<HonoContext>();

api.use(
  rateLimiterGuard({
    prefix: "rate-limiter:ai",
  })
);

const cookieName = (provider?: Provider) => {
  switch (provider) {
    case Provider.OpenAI:
      return OPENAI_API_KEY;
    case Provider.Anthropic:
      return ANTHROPIC_API_KEY;
    case Provider.Google:
      return GENAI_API_KEY;
    case Provider.DeepSeek:
      return DEEPSEEK_API_KEY;
    default:
      return "";
  }
};

api.use(verifyAuth());

api.use(timeout(env.TIMEOUT_MS)).post(
  "/key:signed",
  zValidator(
    "json",
    z.object({
      apiKey: z.string().min(1),
      provider: z.enum(Provider).optional(),
    }),
    (result, c) => {
      if (!result.success) {
        return c.json(errorResponse(result.error), 400);
      }
    }
  ),
  (c) => {
    if (!env.AI_AUTH_PUBLIC_KEY || !env.AI_AUTH_PRIVATE_KEY) {
      return c.json(errorGenerator(503), 503, {
        "Retry-After": "3600",
      });
    }
    setCookie(
      c,
      cookieName(c.req.valid("json").provider),
      encodeApiKey(c.req.valid("json").apiKey, env.AI_AUTH_PUBLIC_KEY),
      {
        domain: getCookieDomain({ env }),
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
      }
    );
    return c.json({ message: "API key saved successfully" });
  }
);

api.post(
  "/generate",
  zValidator(
    "json",
    baseRequestSchema.omit({ authToken: true }),
    (result, c) => {
      if (!result.success) {
        return c.json(errorResponse(result.error), 400);
      }
    }
  ),
  ai(),
  (c) => {
    c.header("Content-Type", "text/plain; charset=utf-8");
    const result = streamGeneratedText({
      model: c.req.valid("json").model,
      messages: c.req.valid("json").messages,
      authToken: c.get(AI_AUTH_TOKEN),
      system: c.req.valid("json").system,
    });
    return result.toUIMessageStreamResponse();
  }
);

export default api;
