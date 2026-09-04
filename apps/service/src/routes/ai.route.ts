import { zValidator } from "@hono/zod-validator";
import { streamText, createTextStreamResponse } from "ai";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { timeout } from "hono/timeout";
import * as z from "zod";

import { HOUSE_MODELS } from "@chia/ai/house-models";
import { KEY_COOKIE_NAMES, KEY_IDS, keyIdSchema } from "@chia/ai/provider";
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
import { encodeApiKey } from "@chia/ai/utils";
import { getCookieDomain } from "@chia/auth/utils";
import { errorGenerator } from "@chia/utils/server";

import { env } from "../env";
import { ai, AI_AUTH_TOKEN, providerCookieName } from "../guards/ai.guard";
import { verifyAuth } from "../guards/auth.guard";
import { rateLimiterGuard } from "../guards/rate-limiter.guard";
import { errorResponse } from "../utils/error.util";

/**
 * Dynamic import so provider SDKs are not loaded at boot. `ai` stays static because
 * `baseRequestSchema` needs `modelMessageSchema` when the route is defined.
 */
const getCreateModel = async () =>
  (await import("@chia/ai/utils/model")).createModel;

/** Content tools run on the house gateway account; the id is the AI SDK's default-provider form. */
const contentModel = HOUSE_MODELS.content;

/** Set and delete must name the same scope, or the delete lands on a different cookie. */
const keyCookieScope = () => ({ domain: getCookieDomain({ env }), path: "/" });

const api = new Hono<HonoContext>()
  .use(
    rateLimiterGuard({
      prefix: "rate-limiter:ai",
    })
  )
  .use(timeout(env.TIMEOUT_MS))
  /**
   * Registered before the signed-in gate so a guest on the public site can bring their own
   * key; the cookie is theirs and every other route still requires a person.
   */
  .post(
    "/key:signed",
    verifyAuth({ allowAnonymous: true }),
    zValidator(
      "json",
      z.object({
        apiKey: z.string().min(1),
        provider: keyIdSchema,
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
      const { apiKey, provider } = c.req.valid("json");
      setCookie(
        c,
        providerCookieName(provider),
        encodeApiKey(apiKey, env.AI_AUTH_PUBLIC_KEY),
        {
          ...keyCookieScope(),
          // Only the server reads it back; a script on the page has no business with a key.
          httpOnly: true,
          secure: env.NODE_ENV === "production",
          sameSite: "strict",
        }
      );
      return c.json({ message: "API key saved successfully" });
    }
  )
  /** Which keys this browser holds. Presence only; the ciphertext never leaves the cookie jar. */
  .get("/keys", verifyAuth({ allowAnonymous: true }), (c) =>
    c.json(
      {
        configured: KEY_IDS.filter((id) =>
          Boolean(getCookie(c, KEY_COOKIE_NAMES[id]))
        ),
      },
      200,
      { "Cache-Control": "no-store" }
    )
  )
  .delete(
    "/key",
    verifyAuth({ allowAnonymous: true }),
    zValidator("json", z.object({ provider: keyIdSchema }), (result, c) => {
      if (!result.success) {
        return c.json(errorResponse(result.error), 400);
      }
    }),
    (c) => {
      deleteCookie(
        c,
        providerCookieName(c.req.valid("json").provider),
        keyCookieScope()
      );
      return c.json({ message: "API key removed" });
    }
  )
  .use(verifyAuth())
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
    async (c) => {
      const { model, messages, system } = c.req.valid("json");
      const createModel = await getCreateModel();
      const result = streamText({
        model: createModel({
          model,
          authToken: c.get(AI_AUTH_TOKEN),
        }),
        messages: messages ?? [],
        system,
      });
      return createTextStreamResponse({
        stream: result.textStream,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
  )
  .post(
    "/content/meta",
    verifyAuth({ rootOnly: true }),
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
            content: { slug: await generateSlug(contentModel, json.input) },
          });
        case SupportedTools.GenerateDescription:
          return c.json({
            feature: SupportedTools.GenerateDescription,
            content: {
              description: await generateDescription(contentModel, json.input),
            },
          });
        case SupportedTools.GenerateSummary:
          return c.json({
            feature: SupportedTools.GenerateSummary,
            content: {
              summary: await generateSummary(contentModel, json.input),
            },
          });
        case SupportedTools.GenerateExcerpt:
          return c.json({
            feature: SupportedTools.GenerateExcerpt,
            content: {
              excerpt: await generateExcerpt(contentModel, json.input),
            },
          });
        default:
          return c.json(errorGenerator(400), 400);
      }
    }
  )
  .post(
    "/content/generate",
    verifyAuth({ rootOnly: true }),
    zValidator("json", generateContentInput, (result, c) => {
      if (!result.success) {
        return c.json(errorResponse(result.error), 400);
      }
    }),
    (c) => {
      const input = c.req.valid("json");
      const result = streamContent(contentModel, input);
      return createTextStreamResponse({
        stream: result.textStream,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
  )
  .post(
    "/content/complete",
    verifyAuth({ rootOnly: true }),
    zValidator("json", generateContentCompleteInput, (result, c) => {
      if (!result.success) {
        return c.json(errorResponse(result.error), 400);
      }
    }),
    async (c) => {
      const input = c.req.valid("json");
      const completion = await generateContentComplete(contentModel, input);
      return c.json({ completion });
    }
  );

export default api;
