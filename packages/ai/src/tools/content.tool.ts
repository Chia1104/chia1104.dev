import { generateText } from "ai";
import type { LanguageModel } from "ai";
import GithubSlugger from "github-slugger";
import * as z from "zod";

const buildPrompt = (title: string, content?: string) =>
  `Title: ${title}${content ? `\n\nContent:\n${content}` : ""}`;

export const generateSlugInput = z.object({
  title: z.string(),
});

export const generateExcerptInput = z.object({
  title: z.string(),
  content: z.string(),
  locale: z.string().default("en"),
});

export const generateSummaryInput = z.object({
  title: z.string(),
  content: z.string(),
  locale: z.string().default("en"),
});

export const generateDescriptionInput = z.object({
  title: z.string(),
  content: z.string().optional(),
  locale: z.string().default("en"),
});

export type GenerateSlugInput = z.infer<typeof generateSlugInput>;
export type GenerateExcerptInput = z.infer<typeof generateExcerptInput>;
export type GenerateSummaryInput = z.infer<typeof generateSummaryInput>;
export type GenerateDescriptionInput = z.infer<typeof generateDescriptionInput>;

export async function generateSlug({
  title,
}: GenerateSlugInput): Promise<string> {
  const slugger = new GithubSlugger();
  return slugger.slug(title);
}

export async function generateExcerpt(
  model: LanguageModel,
  { title, content, locale }: GenerateExcerptInput
): Promise<string> {
  const { text } = await generateText({
    model,
    system:
      `You are a content writer. Write a short excerpt of 1-2 sentences for the given article. ` +
      `The excerpt should be engaging, accurate, and written in the locale: ${locale}. ` +
      `Return ONLY the excerpt text with no extra formatting.`,
    prompt: buildPrompt(title, content),
  });
  return text.trim();
}

export async function generateSummary(
  model: LanguageModel,
  { title, content, locale }: GenerateSummaryInput
): Promise<string> {
  const { text } = await generateText({
    model,
    system:
      `You are a content summariser. Write a structured summary of 3-5 sentences for the given article. ` +
      `Cover the main argument, key points, and takeaway. Write in the locale: ${locale}. ` +
      `Return ONLY the summary text with no extra formatting.`,
    prompt: buildPrompt(title, content),
  });
  return text.trim();
}

export async function generateDescription(
  model: LanguageModel,
  { title, content, locale }: GenerateDescriptionInput
): Promise<string> {
  const { text } = await generateText({
    model,
    system:
      `You are an SEO specialist. Write a meta description of at most 160 characters for the given article. ` +
      `It must be concise, include a subtle call-to-action, and written in locale: ${locale}. ` +
      `Return ONLY the description text with no extra formatting.`,
    prompt: buildPrompt(title, content),
  });
  return text.trim().slice(0, 160);
}
