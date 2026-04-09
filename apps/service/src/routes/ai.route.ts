import { gateway } from "@ai-sdk/gateway";
import { zValidator } from "@hono/zod-validator";
import { streamText } from "ai";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { timeout } from "hono/timeout";
import * as z from "zod";

import {
  OPENAI_API_KEY,
  ANTHROPIC_API_KEY,
  GENAI_API_KEY,
} from "@chia/ai/constants";
import {
  generateSlug,
  generateDescription,
  generateSlugInput,
  generateDescriptionInput,
  generateSummary,
  generateSummaryInput,
  generateExcerpt,
  generateExcerptInput,
  generateContentInput,
  generateContentComplete,
  generateContentCompleteInput,
  streamContent,
} from "@chia/ai/tools/content";
import { SupportedTools } from "@chia/ai/types";
import { baseRequestSchema } from "@chia/ai/types";
import { Provider } from "@chia/ai/types";
import { createModel } from "@chia/ai/utils";
import { encodeApiKey } from "@chia/ai/utils";
import { getCookieDomain } from "@chia/auth/utils";
import { errorGenerator } from "@chia/utils/server";

import { env } from "../env";
import { ai, AI_AUTH_TOKEN } from "../guards/ai.guard";
import { verifyAuth } from "../guards/auth.guard";
import { rateLimiterGuard } from "../guards/rate-limiter.guard";
import { errorResponse } from "../utils/error.util";

const cookieName = (provider?: Provider) => {
  switch (provider) {
    case Provider.OpenAI:
      return OPENAI_API_KEY;
    case Provider.Anthropic:
      return ANTHROPIC_API_KEY;
    case Provider.Google:
      return GENAI_API_KEY;
    default:
      return "";
  }
};

const api = new Hono<HonoContext>()
  .use(
    rateLimiterGuard({
      prefix: "rate-limiter:ai",
    })
  )
  .use(verifyAuth())
  .use(timeout(env.TIMEOUT_MS))
  .post(
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
  )
  .post(
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
      const { model, messages, system } = c.req.valid("json");
      const result = streamText({
        model: createModel({
          model,
          authToken: c.get(AI_AUTH_TOKEN),
        }),
        messages: messages ?? [],
        system,
      });
      return result.toUIMessageStreamResponse();
    }
  )
  .get("/models", async (c) => {
    const availableModels = await gateway.getAvailableModels();
    return c.json(availableModels.models);
  })
  .post(
    "/content/meta",
    verifyAuth(true),
    zValidator(
      "json",
      z.union([
        z.object({
          feature: z.literal(SupportedTools.GenerateSlug),
          input: generateSlugInput,
        }),
        z.object({
          feature: z.literal(SupportedTools.GenerateDescription),
          input: generateDescriptionInput,
        }),
        z.object({
          feature: z.literal(SupportedTools.GenerateSummary),
          input: generateSummaryInput,
        }),
        z.object({
          feature: z.literal(SupportedTools.GenerateExcerpt),
          input: generateExcerptInput,
        }),
      ]),
      (result, c) => {
        if (!result.success) {
          return c.json(errorResponse(result.error), 400);
        }
      }
    ),
    async (c) => {
      const json = c.req.valid("json");
      switch (json.feature) {
        case SupportedTools.GenerateSlug:
          return c.json({
            feature: SupportedTools.GenerateSlug,
            content: {
              slug: await generateSlug("openai/gpt-4o-mini", json.input),
            },
          });
        case SupportedTools.GenerateDescription:
          return c.json({
            feature: SupportedTools.GenerateDescription,
            content: {
              description: await generateDescription(
                "openai/gpt-4o-mini",
                json.input
              ),
            },
          });
        case SupportedTools.GenerateSummary:
          return c.json({
            feature: SupportedTools.GenerateSummary,
            content: {
              summary: await generateSummary("openai/gpt-4o-mini", json.input),
            },
          });
        case SupportedTools.GenerateExcerpt:
          return c.json({
            feature: SupportedTools.GenerateExcerpt,
            content: {
              excerpt: await generateExcerpt("openai/gpt-4o-mini", json.input),
            },
          });
        default:
          return c.json(errorGenerator(400), 400);
      }
    }
  )
  .post(
    "/content/generate",
    verifyAuth(true),
    zValidator("json", generateContentInput, (result, c) => {
      if (!result.success) {
        return c.json(errorResponse(result.error), 400);
      }
    }),
    (c) => {
      c.header("Content-Type", "text/plain; charset=utf-8");
      const input = c.req.valid("json");
      const result = streamContent("openai/gpt-4o-mini", input);
      return result.toTextStreamResponse();
    }
  )
  .post(
    "/content/complete",
    verifyAuth(true),
    zValidator("json", generateContentCompleteInput, (result, c) => {
      if (!result.success) {
        return c.json(errorResponse(result.error), 400);
      }
    }),
    async (c) => {
      const input = c.req.valid("json");
      const completion = await generateContentComplete(
        "openai/gpt-4o-mini",
        input
      );
      return c.json({ completion });
    }
  );

export default api;
