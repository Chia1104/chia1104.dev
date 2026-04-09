import { generateText, streamText } from "ai";
import type { LanguageModel, StreamTextResult, ToolSet } from "ai";
import * as z from "zod";

import { slugger } from "../utils";

const buildPrompt = (title: string, content?: string) =>
  `Title: ${title}${content ? `\n\nContent:\n${content}` : ""}`;

export const generateSlugInput = z.object({
  title: z.string(),
  content: z.string().optional(),
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

export const generateContentInput = z.object({
  title: z.string(),
  context: z.string().optional(),
  outline: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  locale: z.string().default("en"),
  length: z.enum(["short", "medium", "long"]).default("medium"),
});

export const generateContentCompleteInput = z.object({
  title: z.string(),
  textBeforeCursor: z.string().min(1),
  locale: z.string().default("en"),
});

export type GenerateSlugInput = z.infer<typeof generateSlugInput>;
export type GenerateExcerptInput = z.infer<typeof generateExcerptInput>;
export type GenerateSummaryInput = z.infer<typeof generateSummaryInput>;
export type GenerateDescriptionInput = z.infer<typeof generateDescriptionInput>;
export type GenerateContentInput = z.infer<typeof generateContentInput>;
export type GenerateContentCompleteInput = z.infer<
  typeof generateContentCompleteInput
>;

export async function generateSlug(
  model: LanguageModel,
  { title, content }: GenerateSlugInput
): Promise<string> {
  const { text } = await generateText({
    model,
    system:
      "You are a slug generator. Given an article title and optional content, " +
      "produce a single concise URL-friendly slug. " +
      "Rules: lowercase letters, numbers, and hyphens only; no spaces or special characters; " +
      "3-6 meaningful words; return ONLY the slug with no extra text.",
    prompt: buildPrompt(title, content),
  });
  return slugger.slug(text);
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

const LENGTH_GUIDE = {
  short: "300-500 words",
  medium: "600-900 words",
  long: "1000-1500 words",
} as const;

const buildContentPrompt = ({
  title,
  context,
  outline,
  keywords,
}: Pick<
  GenerateContentInput,
  "title" | "context" | "outline" | "keywords"
>) => {
  const parts: string[] = [`Title: ${title}`];
  if (context) parts.push(`Context / surrounding content:\n${context}`);
  if (outline) parts.push(`Outline to follow:\n${outline}`);
  if (keywords?.length)
    parts.push(`Keywords to naturally include: ${keywords.join(", ")}`);
  return parts.join("\n\n");
};

export async function generateContent(
  model: LanguageModel,
  { title, context, outline, keywords, locale, length }: GenerateContentInput
): Promise<string> {
  const { text } = await generateText({
    model,
    system:
      `You are a professional content writer. Write a well-structured article body (${LENGTH_GUIDE[length]}) ` +
      `based on the given title and optional context. ` +
      `Guidelines: use clear headings (##) where appropriate; write in a natural, engaging tone; ` +
      `do not repeat the title as an H1; write in locale: ${locale}. ` +
      `Return ONLY the article content in Markdown with no preamble or meta commentary.`,
    prompt: buildContentPrompt({ title, context, outline, keywords }),
  });
  return text.trim();
}

export async function generateContentComplete(
  model: LanguageModel,
  { title, textBeforeCursor, locale }: GenerateContentCompleteInput
): Promise<string> {
  const { text } = await generateText({
    model,
    system:
      `You are an AI writing assistant embedded in a markdown blog editor. ` +
      `Continue the author's text naturally from the cursor position. ` +
      `Match the existing language, style, and tone exactly. Write in locale: ${locale}. ` +
      `CRITICAL: Return ONLY the new text to insert at the cursor — do NOT repeat any existing text. ` +
      `Keep it concise: 1-3 sentences or up to one short paragraph.`,
    prompt: `Article title: ${title}\n\nText so far:\n${textBeforeCursor}`,
  });
  return text.trim();
}

export function streamContent(
  model: LanguageModel,
  { title, context, outline, keywords, locale, length }: GenerateContentInput
): StreamTextResult<ToolSet, never> {
  return streamText({
    model,
    system:
      `You are a professional content writer. Write a well-structured article body (${LENGTH_GUIDE[length]}) ` +
      `based on the given title and optional context. ` +
      `Guidelines: use clear headings (##) where appropriate; write in a natural, engaging tone; ` +
      `do not repeat the title as an H1; write in locale: ${locale}. ` +
      `Return ONLY the article content in Markdown with no preamble or meta commentary.`,
    prompt: buildContentPrompt({ title, context, outline, keywords }),
  });
}
