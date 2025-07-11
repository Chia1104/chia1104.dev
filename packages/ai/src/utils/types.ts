import { z } from "zod";

export const Provider = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  Google: "google",
  DeepSeek: "deep-seek",
} as const;

export type Provider = (typeof Provider)[keyof typeof Provider];

// https://platform.openai.com/docs/models
export const OpenAIModel = {
  "gpt-4.1": "gpt-4.1",
  "gpt-4o": "gpt-4o",
  "gpt-4o-mini": "gpt-4o-mini",
  "gpt-4": "gpt-4",
  "o3-mini": "o3-mini",
  o1: "o1",
  "o1-mini": "o1-mini",
} as const;

export type OpenAIModel = (typeof OpenAIModel)[keyof typeof OpenAIModel];

// https://docs.anthropic.com/en/docs/about-claude/models/all-models
export const AnthropicModel = {
  "claude-3-5-haiku": "claude-3-5-haiku-latest",
  "claude-3-7-sonnet": "claude-3-7-sonnet-latest",
} as const;

export type AnthropicModel =
  (typeof AnthropicModel)[keyof typeof AnthropicModel];

// https://ai.google.dev/gemini-api/docs/models
export const GoogleModel = {
  "gemini-2.5-flash": "gemini-2.5-flash-preview-04-17",
  "gemini-2.5-pro": "gemini-2.5-pro-preview-03-25",
  "gemini-2.0-flash": "gemini-2.0-flash",
} as const;

export type GoogleModel = (typeof GoogleModel)[keyof typeof GoogleModel];

export const Role = {
  User: "user",
  Assistant: "assistant",
} as const;

export const DeepSeekModel = {
  "deepseek-r1": "deepseek-reasoner",
} as const;

export type DeepSeekModel = (typeof DeepSeekModel)[keyof typeof DeepSeekModel];

export type Role = (typeof Role)[keyof typeof Role];

export const messageSchema = z.object({
  role: z.enum(Role).optional().default(Role.User),
  content: z.string(),
});

export type Message = z.infer<typeof messageSchema>;

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
    z.object({
      provider: z.literal(Provider.DeepSeek),
      id: z.enum(DeepSeekModel),
    }),
  ])
  .optional()
  .default({
    provider: Provider.OpenAI,
    id: OpenAIModel["o3-mini"],
  });

export type Model = z.infer<typeof modelSchema>;

export const baseRequestSchema = z.object({
  model: modelSchema,
  messages: z.array(messageSchema).min(1),
  authToken: z.string().min(1),
  system: z.string().optional(),
});

export type BaseRequest = z.infer<typeof baseRequestSchema>;

export const authTokenSchema = z.object({
  apiKey: z.string().min(1),
});

export type AuthToken = z.infer<typeof authTokenSchema>;
