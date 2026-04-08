import { modelMessageSchema } from "ai";
import type { ModelMessage } from "ai";
import * as z from "zod";

export const Provider = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  Google: "google",
  /**
   * @deprecated
   */
  DeepSeek: "deep-seek",
} as const;

export type Provider = (typeof Provider)[keyof typeof Provider];

// https://platform.openai.com/docs/models
/**
 * @deprecated Get supported models from the Vercel AI Gateway.
 */
export const OpenAIModel = {
  "gpt-5.4": "gpt-5.4",
  "gpt-5.4-mini": "gpt-5.4-mini",
  "gpt-5.4-nano": "gpt-5.4-nano",
  "gpt-4o": "gpt-4o",
  "gpt-4o-mini": "gpt-4o-mini",
} as const;

export type OpenAIModel = (typeof OpenAIModel)[keyof typeof OpenAIModel];

// https://docs.anthropic.com/en/docs/about-claude/models/all-models
/**
 * @deprecated Get supported models from the Vercel AI Gateway.
 */
export const AnthropicModel = {
  "claude-opus-4-6": "claude-opus-4-6",
  "claude-sonnet-4-6": "claude-sonnet-4-6",
  "claude-haiku-4-5": "claude-haiku-4-5",
} as const;

export type AnthropicModel =
  (typeof AnthropicModel)[keyof typeof AnthropicModel];

// https://ai.google.dev/gemini-api/docs/models
/**
 * @deprecated Get supported models from the Vercel AI Gateway.
 */
export const GoogleModel = {
  "gemini-3.1-flash": "gemini-3.1-flash",
  "gemini-3.1-pro": "gemini-3.1-pro",
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini-2.5-pro": "gemini-2.5-pro",
  "gemini-2.0-flash": "gemini-2.0-flash",
} as const;

export type GoogleModel = (typeof GoogleModel)[keyof typeof GoogleModel];

export const Role = {
  User: "user",
  Assistant: "assistant",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const modelSchema = z
  .union([
    z.object({
      provider: z.literal(Provider.OpenAI),
      id: z.enum(OpenAIModel),
    }),
    z.object({
      provider: z.literal(Provider.Anthropic),
      id: z.enum(AnthropicModel),
    }),
    z.object({
      provider: z.literal(Provider.Google),
      id: z.enum(GoogleModel),
    }),
  ])
  .optional()
  .default({
    provider: Provider.OpenAI,
    id: OpenAIModel["gpt-5.4-mini"],
  });

export type Model = z.infer<typeof modelSchema>;

export const SupportedTools = {
  GenerateSlug: "generate-slug",
  GenerateExcerpt: "generate-excerpt",
  GenerateSummary: "generate-summary",
  GenerateDescription: "generate-description",
} as const;

export type SupportedTools =
  (typeof SupportedTools)[keyof typeof SupportedTools];

export const baseRequestSchema = z.object({
  model: modelSchema,
  messages: z.array(modelMessageSchema).optional(),
  authToken: z.string().min(1),
  system: z.string().optional(),
  proxyUrl: z.string().optional(),
});

export type BaseRequest = z.infer<typeof baseRequestSchema>;

export const authTokenSchema = z.object({
  apiKey: z.string().min(1),
});

export type AuthToken = z.infer<typeof authTokenSchema>;

export { ModelMessage };
