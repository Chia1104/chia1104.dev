import { z } from "zod";

// https://platform.openai.com/docs/models
export const OpenAIModal = {
  "gpt-4o": "gpt-4o-2024-08-06",
  "gpt-4o-2024-08-06": "gpt-4o-2024-08-06",
  "gpt-4o-mini": "gpt-4o-mini",
  "gpt-4": "gpt-4",
  "gpt-3.5-turbo": "gpt-3.5-turbo",
} as const;

export type OpenAIModal = (typeof OpenAIModal)[keyof typeof OpenAIModal];

export const Role = {
  User: "user",
  Assistant: "assistant",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const messageSchema = z.object({
  role: z.nativeEnum(Role).optional().default(Role.User),
  content: z.string(),
});

export type Message = z.infer<typeof messageSchema>;

export const baseRequestSchema = z.object({
  modal: z
    .nativeEnum(OpenAIModal)
    .optional()
    .default(OpenAIModal["gpt-4o-mini"]),
  messages: z.array(messageSchema).min(1),
  authToken: z.string().min(1),
  system: z.string().optional(),
});

export type BaseRequest = z.infer<typeof baseRequestSchema>;

export const authTokenSchema = z.object({
  apiKey: z.string().min(1),
});

export type AuthToken = z.infer<typeof authTokenSchema>;
