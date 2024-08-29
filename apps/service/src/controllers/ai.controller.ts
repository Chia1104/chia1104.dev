import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { setSignedCookie } from "hono/cookie";
import { streamText } from "hono/streaming";

import { HEADER_AUTH_TOKEN } from "@chia/ai/constants";
import { streamGeneratedText } from "@chia/ai/generate/utils";
import { baseRequestSchema } from "@chia/ai/types";
import { encodeApiKey } from "@chia/ai/utils";
import { errorGenerator } from "@chia/utils";

import { env } from "@/env";
import { ai, AI_AUTH_TOKEN } from "@/middlewares/ai.middleware";
import { verifyAuth } from "@/middlewares/auth.middleware";
import { errorResponse } from "@/utils/error.util";

const api = new Hono<HonoContext>();

api.use(verifyAuth());

api.post(
  "/key:signed",
  zValidator(
    "json",
    baseRequestSchema.pick({ authToken: true }),
    (result, c) => {
      if (!result.success) {
        return c.json(errorResponse(result.error), 400);
      }
    }
  ),
  async (c) => {
    if (!env.AI_AUTH_SECRET || !env.OPENAI_API_KEY) {
      return c.json(errorGenerator(503), 503, {
        "Retry-After": "3600",
      });
    }
    await setSignedCookie(
      c,
      HEADER_AUTH_TOKEN,
      encodeApiKey(c.req.valid("json").authToken, env.AI_AUTH_SECRET),
      env.AI_AUTH_SECRET
    );
    return c.json({ message: "API key saved successfully" });
  }
);

api.use("/generate", ai()).post(
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
  (c) => {
    return streamText(c, async (stream) => {
      const result = await streamGeneratedText({
        modal: c.req.valid("json").modal,
        messages: c.req.valid("json").messages,
        authToken: c.get(AI_AUTH_TOKEN),
      });

      for await (const textPart of result.textStream) {
        await stream.write(textPart);
      }
    });
  }
);

export default api;
