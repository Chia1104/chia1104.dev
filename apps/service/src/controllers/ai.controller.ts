import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { stream } from "hono/streaming";
import { z } from "zod";

import {
  HEADER_AUTH_TOKEN,
  OPENAI_API_KEY,
  ANTHROPIC_API_KEY,
  GOOGLE_API_KEY,
  DEEPSEEK_API_KEY,
} from "@chia/ai/constants";
import { streamGeneratedText } from "@chia/ai/generate/utils";
import { baseRequestSchema } from "@chia/ai/types";
import { Provider } from "@chia/ai/types";
import { encodeApiKey } from "@chia/ai/utils";
import { getCookieDomain } from "@chia/auth/utils";
import { errorGenerator } from "@chia/utils";

import { env } from "@/env";
import { ai, AI_AUTH_TOKEN } from "@/guards/ai.guard";
import { verifyAuth } from "@/guards/auth.guard";
import { errorResponse } from "@/utils/error.util";

const api = new Hono<HonoContext>();

const cookieName = (provider?: Provider) => {
  switch (provider) {
    case Provider.OpenAI:
      return OPENAI_API_KEY;
    case Provider.Anthropic:
      return ANTHROPIC_API_KEY;
    case Provider.Google:
      return GOOGLE_API_KEY;
    case Provider.DeepSeek:
      return DEEPSEEK_API_KEY;
    default:
      return HEADER_AUTH_TOKEN;
  }
};

api.use(verifyAuth());

api.post(
  "/key:signed",
  zValidator(
    "json",
    z.object({
      apiKey: z.string().min(1),
      provider: z.nativeEnum(Provider).optional(),
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
        domain: getCookieDomain({ env: c.env }),
        secure: c.env.NODE_ENV === "production",
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
      modal: c.req.valid("json").modal,
      messages: c.req.valid("json").messages,
      authToken: c.get(AI_AUTH_TOKEN),
      system: c.req.valid("json").system,
    });
    return stream(c, (stream) => stream.pipe(result.toDataStream()));
  }
);

export default api;
