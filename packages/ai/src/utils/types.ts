import { modelMessageSchema } from "ai";
import type { ModelMessage } from "ai";
import * as z from "zod";

import { providerIdSchema } from "../provider";

/** A native model on a vendor the caller holds a key for; the id is theirs to choose. */
export const modelSchema = z.object({
  provider: providerIdSchema,
  id: z.string().min(1),
});

export type Model = z.infer<typeof modelSchema>;

export const SupportedTools = {
  GenerateSlug: "generate-slug",
  GenerateExcerpt: "generate-excerpt",
  GenerateSummary: "generate-summary",
  GenerateDescription: "generate-description",
  GenerateContent: "generate-content",
} as const;

export type SupportedTools =
  (typeof SupportedTools)[keyof typeof SupportedTools];

export const baseRequestSchema = z.object({
  model: modelSchema,
  messages: z.array(modelMessageSchema).optional(),
  authToken: z.string().min(1),
  system: z.string().optional(),
});

export type BaseRequest = z.infer<typeof baseRequestSchema>;

export { ModelMessage };
