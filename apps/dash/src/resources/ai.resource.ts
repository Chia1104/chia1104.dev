import type * as z from "zod";

import type { ProviderId } from "@chia/ai/provider";
import type {
  generateContentCompleteInput,
  generateContentInput,
  generateDescriptionInput,
  generateExcerptInput,
  generateSlugInput,
  generateSummaryInput,
} from "@chia/ai/tools/content";
import type { baseRequestSchema, SupportedTools } from "@chia/ai/types";

import { postJson, postTextStream } from "@/libs/service/fetcher";

/** AI endpoints stay on Hono (streaming, `Set-Cookie`), so these are plain fetch calls typed from `@chia/ai`. */

export interface SignAIKeyResponse {
  message: string;
}

export type GenerateAIContentInput = Omit<
  z.infer<typeof baseRequestSchema>,
  "authToken"
>;

export type GenerateAIArticleContentInput = z.infer<
  typeof generateContentInput
>;

export type GenerateAIContentCompleteInput = z.infer<
  typeof generateContentCompleteInput
>;

/** Mirrors the discriminated union `POST /api/v1/ai/content/meta` validates. */
export type GenerateAIContentMetaInput =
  | {
      feature: typeof SupportedTools.GenerateSlug;
      input: z.infer<typeof generateSlugInput>;
    }
  | {
      feature: typeof SupportedTools.GenerateDescription;
      input: z.infer<typeof generateDescriptionInput>;
    }
  | {
      feature: typeof SupportedTools.GenerateSummary;
      input: z.infer<typeof generateSummaryInput>;
    }
  | {
      feature: typeof SupportedTools.GenerateExcerpt;
      input: z.infer<typeof generateExcerptInput>;
    };

export type GenerateAIContentMetaResponse =
  | {
      feature: typeof SupportedTools.GenerateSlug;
      content: { slug: string };
    }
  | {
      feature: typeof SupportedTools.GenerateDescription;
      content: { description: string };
    }
  | {
      feature: typeof SupportedTools.GenerateSummary;
      content: { summary: string };
    }
  | {
      feature: typeof SupportedTools.GenerateExcerpt;
      content: { excerpt: string };
    };

export const getSignedAIKey = (apiKey: string, provider: ProviderId) =>
  postJson<SignAIKeyResponse>("/ai/key:signed", { apiKey, provider });

export const generateAIContent = (input: GenerateAIContentInput) =>
  postTextStream("/ai/generate", input);

export const generateAIArticleContent = (
  input: GenerateAIArticleContentInput
) => postTextStream("/ai/content/generate", input);

export const generateAIContentComplete = async (
  input: GenerateAIContentCompleteInput
): Promise<string> => {
  const { completion } = await postJson<{ completion: string }>(
    "/ai/content/complete",
    input
  );
  return completion;
};

export const generateAIContentMeta = (input: GenerateAIContentMetaInput) =>
  postJson<GenerateAIContentMetaResponse>("/ai/content/meta", input);
