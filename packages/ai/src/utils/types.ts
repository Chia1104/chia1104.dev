import { z } from "zod";

export const Provider = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  Google: "google",
  DeepSeek: "deep-seek",
} as const;

export type Provider = (typeof Provider)[keyof typeof Provider];

// https://platform.openai.com/docs/models
export const OpenAIModal = {
  "gpt-4o": "gpt-4o",
  "gpt-4o-mini": "gpt-4o-mini",
  "gpt-4": "gpt-4",
  "o3-mini": "o3-mini",
  o1: "o1",
  "o1-mini": "o1-mini",
} as const;

export type OpenAIModal = (typeof OpenAIModal)[keyof typeof OpenAIModal];

export const AnthropicModal = {
  "claude-3-5-sonnet": "claude-3-5-sonnet",
  "claude-3-7-sonnet": "claude-3-7-sonnet",
} as const;

export type AnthropicModal =
  (typeof AnthropicModal)[keyof typeof AnthropicModal];

export const GoogleModal = {
  "gemini-2.0-flash": "gemini-2.0-flash",
} as const;

export type GoogleModal = (typeof GoogleModal)[keyof typeof GoogleModal];

export const Role = {
  User: "user",
  Assistant: "assistant",
} as const;

export const DeepSeekModal = {
  "deepseek-r1": "deepseek-reasoner",
} as const;

export type DeepSeekModal = (typeof DeepSeekModal)[keyof typeof DeepSeekModal];

export type Role = (typeof Role)[keyof typeof Role];

export const messageSchema = z.object({
  role: z.nativeEnum(Role).optional().default(Role.User),
  content: z.string(),
});

export type Message = z.infer<typeof messageSchema>;

export const modalSchema = z
  .union([
    z.object({
      provider: z.literal(Provider.OpenAI),
      id: z.nativeEnum(OpenAIModal),
    }),
    z.object({
      provider: z.literal(Provider.Anthropic),
      id: z.nativeEnum(AnthropicModal),
    }),
    z.object({
      provider: z.literal(Provider.Google),
      id: z.nativeEnum(GoogleModal),
    }),
    z.object({
      provider: z.literal(Provider.DeepSeek),
      id: z.nativeEnum(DeepSeekModal),
    }),
  ])
  .optional()
  .default({
    provider: Provider.OpenAI,
    id: OpenAIModal["o3-mini"],
  });

export type Modal = z.infer<typeof modalSchema>;

export const baseRequestSchema = z.object({
  modal: modalSchema,
  messages: z.array(messageSchema).min(1),
  authToken: z.string().min(1),
  system: z.string().optional(),
});

export type BaseRequest = z.infer<typeof baseRequestSchema>;

export const authTokenSchema = z.object({
  apiKey: z.string().min(1),
});

export type AuthToken = z.infer<typeof authTokenSchema>;
