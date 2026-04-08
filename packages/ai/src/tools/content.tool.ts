import { generateText, tool } from "ai";
import type { LanguageModel } from "ai";
import * as z from "zod";

import { slugger } from "../utils";

const buildPrompt = (title: string, content?: string) =>
  `Title: ${title}${content ? `\n\nContent (excerpt):\n${content.slice(0, 800)}` : ""}`;

const DEFAULT_MODEL: LanguageModel = "openai/gpt-4o-mini";

const generateSlugTool = (model: LanguageModel = DEFAULT_MODEL) =>
  tool({
    description:
      "Generate a concise, URL-friendly slug that semantically summarises the given title and content",
    inputSchema: z.object({
      title: z.string().describe("The title to generate a slug for"),
      content: z
        .string()
        .optional()
        .describe("The content to generate a slug for"),
    }),
    execute: async ({ title, content }) => {
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
    },
  });

const generateExcerptTool = (model: LanguageModel = DEFAULT_MODEL) =>
  tool({
    description:
      "Generate a short, compelling excerpt (1-2 sentences) suitable for article preview cards",
    inputSchema: z.object({
      title: z.string().describe("Article title"),
      content: z.string().describe("Full article content"),
      locale: z
        .string()
        .optional()
        .default("en")
        .describe("Output language locale, e.g. 'en', 'zh-TW'"),
    }),
    execute: async ({ title, content, locale }) => {
      const { text } = await generateText({
        model,
        system:
          `You are a content writer. Write a short excerpt of 1-2 sentences for the given article. ` +
          `The excerpt should be engaging, accurate, and written in the locale: ${locale}. ` +
          `Return ONLY the excerpt text with no extra formatting.`,
        prompt: buildPrompt(title, content),
      });
      return text.trim();
    },
  });

const generateSummaryTool = (model: LanguageModel = DEFAULT_MODEL) =>
  tool({
    description:
      "Generate a structured summary (3-5 sentences) that captures the key points of an article",
    inputSchema: z.object({
      title: z.string().describe("Article title"),
      content: z.string().describe("Full article content"),
      locale: z
        .string()
        .optional()
        .default("en")
        .describe("Output language locale, e.g. 'en', 'zh-TW'"),
    }),
    execute: async ({ title, content, locale }) => {
      const { text } = await generateText({
        model,
        system:
          `You are a content summariser. Write a structured summary of 3-5 sentences for the given article. ` +
          `Cover the main argument, key points, and takeaway. Write in the locale: ${locale}. ` +
          `Return ONLY the summary text with no extra formatting.`,
        prompt: buildPrompt(title, content),
      });
      return text.trim();
    },
  });

const generateDescriptionTool = (model: LanguageModel = DEFAULT_MODEL) =>
  tool({
    description:
      "Generate an SEO meta description (at most 160 characters) optimised for search engines",
    inputSchema: z.object({
      title: z.string().describe("Article title"),
      content: z
        .string()
        .optional()
        .describe("Article content or excerpt for context"),
      locale: z
        .string()
        .optional()
        .default("en")
        .describe("Output language locale, e.g. 'en', 'zh-TW'"),
    }),
    execute: async ({ title, content, locale }) => {
      const { text } = await generateText({
        model,
        system:
          `You are an SEO specialist. Write a meta description of at most 160 characters for the given article. ` +
          `It must be concise, include a subtle call-to-action, and written in locale: ${locale}. ` +
          `Return ONLY the description text with no extra formatting.`,
        prompt: buildPrompt(title, content),
      });
      return text.trim().slice(0, 160);
    },
  });

export {
  generateSlugTool,
  generateExcerptTool,
  generateSummaryTool,
  generateDescriptionTool,
};
