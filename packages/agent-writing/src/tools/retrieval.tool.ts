import { StringEnum } from "@earendil-works/pi-ai";

import { buildDocumentContext } from "@chia/ai/embeddings/context";
import type { Locale } from "@chia/db/types";

import type { WritingTool } from "../types.ts";

import { TOOL_NAMES, labelOf } from "./registry.ts";
import {
  LocaleSchema,
  Type,
  defineTool,
  jsonBlock,
  textResult,
  truncate,
} from "./schema.ts";

/**
 * Tier 1 — read-only grounding tools.
 *
 * All `executionMode: "parallel"`: they have no side effects, and the model routinely wants
 * three of them at once when orienting itself ("what have I written about X, what tags exist,
 * what does this reference page say").
 */

/**
 * Token budget for one `getPost` call, shared across the post's locales.
 * Tokens rather than characters: the same character count is ~3x the tokens in
 * Chinese as in English, so a character cap silently means different things.
 */
const POST_BODY_TOKEN_BUDGET = 12_000;
const MAX_PAGE_CHARS = 16_000;

export const searchPostsTool = defineTool({
  name: TOOL_NAMES.searchPosts,
  label: labelOf(TOOL_NAMES.searchPosts),
  description:
    "Search existing published posts. Use this BEFORE writing anything new: it is how you avoid " +
    "duplicating a post that already exists, and how you find posts worth cross-linking. " +
    "`semantic` matches on meaning (best for topics); `keyword` matches on literal terms (best for " +
    "names, APIs, error messages).",
  parameters: Type.Object({
    keyword: Type.String({
      description: "The topic or phrase to look for.",
      minLength: 1,
    }),
    // Optional, not required-with-a-default: typebox's `default` is documentation for the model,
    // it does not make a field optional, and a required field the model must always restate is
    // pure friction. `execute` falls back to semantic.
    mode: Type.Optional(
      StringEnum(["semantic", "keyword"], {
        description:
          "`semantic` (default) for conceptual similarity, `keyword` for literal term matching.",
        default: "semantic",
      })
    ),
    locale: Type.Optional(
      LocaleSchema("Restrict to one locale. Omit to search all.")
    ),
    limit: Type.Optional(
      Type.Integer({
        description: "Maximum results (1-20).",
        minimum: 1,
        maximum: 20,
        default: 5,
      })
    ),
  }),
  executionMode: "parallel",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    const hits = await context.content.searchPosts({
      keyword: params.keyword,
      locale: params.locale as Locale | undefined,
      mode: params.mode === "keyword" ? "keyword" : "semantic",
      limit: params.limit ?? 5,
    });

    if (hits.length === 0) {
      return textResult(
        `No existing post matches "${params.keyword}". This topic looks unwritten.`,
        { hits: [] }
      );
    }

    return textResult(
      `${hits.length} matching post(s):\n\n${jsonBlock(hits)}`,
      { hits }
    );
  },
});

export const getPostTool = defineTool({
  name: TOOL_NAMES.getPost,
  label: labelOf(TOOL_NAMES.getPost),
  description:
    "Read one existing post in full, including every locale's metadata and MDX body. Use it to " +
    "match an existing post's voice and structure, or to see how a component is used in practice. " +
    "Provide either `slug` or `feedId`.",
  parameters: Type.Object({
    slug: Type.Optional(Type.String({ description: "Post slug." })),
    feedId: Type.Optional(Type.Integer({ description: "Numeric feed id." })),
    locale: Type.Optional(
      LocaleSchema("Return only this locale. Omit for all locales.")
    ),
  }),
  executionMode: "parallel",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    if (!params.slug && params.feedId === undefined) {
      throw new Error("Provide either `slug` or `feedId`.");
    }

    const post = await context.content.getPost({
      slug: params.slug,
      feedId: params.feedId,
      locale: params.locale as Locale | undefined,
    });

    if (!post) {
      throw new Error(
        `No post found for ${params.slug ? `slug "${params.slug}"` : `feedId ${params.feedId}`}.`
      );
    }

    /**
     * One token budget shared by every locale of the post, rather than a
     * per-locale character cap. A 3-locale zh-TW post could otherwise be
     * "within the limit" three times over and still blow the context window,
     * since Chinese costs far more tokens per character than the character
     * count suggests.
     *
     * Long bodies degrade to their matched sections and then to
     * summary + outline instead of being cut off mid-sentence, and each kept
     * heading comes back with the anchor the site renders, so the model can
     * cite `slug#heading` rather than just naming the post.
     */
    const context_ = await buildDocumentContext(
      post.translations.map((translation) => ({
        slug: post.slug,
        locale: translation.locale,
        title: translation.title,
        summary: translation.summary ?? translation.description,
        content: translation.content ?? "",
      })),
      { budget: POST_BODY_TOKEN_BUDGET }
    );

    const byLocale = new Map(
      context_.documents.map((document) => [document.locale, document])
    );
    const translations = post.translations.map((translation) => {
      const document = byLocale.get(translation.locale);
      return {
        ...translation,
        content: document?.text ?? "",
        detail: document?.detail ?? "outline",
        tokenCount: document?.tokenCount ?? 0,
        anchors: document?.anchors.map((anchor) => anchor.anchor) ?? [],
      };
    });

    return textResult(
      `Post "${post.slug}" (${context_.totalTokens} tokens of ${context_.budget}):\n\n${jsonBlock(
        { ...post, translations }
      )}`,
      { post: { ...post, translations }, contextTokens: context_.totalTokens }
    );
  },
});

export const listPostsTool = defineTool({
  name: TOOL_NAMES.listPosts,
  label: labelOf(TOOL_NAMES.listPosts),
  description:
    "List recent posts (newest first), including unpublished drafts. Useful for seeing what is " +
    "already in flight before starting something new.",
  parameters: Type.Object({
    limit: Type.Optional(
      Type.Integer({
        description: "Maximum results (1-50).",
        minimum: 1,
        maximum: 50,
        default: 20,
      })
    ),
    published: Type.Optional(
      Type.Boolean({
        description:
          "`true` for published only, `false` for drafts only. Omit for both.",
      })
    ),
  }),
  executionMode: "parallel",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    const posts = await context.content.listPosts({
      adminId: context.adminId,
      limit: params.limit ?? 20,
      published: params.published,
    });
    return textResult(`${posts.length} post(s):\n\n${jsonBlock(posts)}`, {
      posts,
    });
  },
});

export const listTagsTool = defineTool({
  name: TOOL_NAMES.listTags,
  label: labelOf(TOOL_NAMES.listTags),
  description:
    "List every existing tag with its localised names. Prefer reusing an existing tag over " +
    "inventing a near-duplicate. Note: tags recorded on a draft are suggestions for the operator — " +
    "committing a draft does not attach them.",
  parameters: Type.Object({}),
  executionMode: "parallel",
  async execute(_toolCallId, _params, _signal, _onUpdate, context) {
    const tags = await context.content.listTags();
    return textResult(`${tags.length} tag(s):\n\n${jsonBlock(tags)}`, { tags });
  },
});

export const fetchUrlTool = defineTool({
  name: TOOL_NAMES.fetchUrl,
  label: labelOf(TOOL_NAMES.fetchUrl),
  description:
    "Fetch a public web page and return its readable text. Use it to check a fact or read a " +
    "reference the operator linked. Returns plain text only — no scripts, no images.",
  parameters: Type.Object({
    url: Type.String({
      description: "Absolute http(s) URL.",
      format: "uri",
    }),
  }),
  executionMode: "parallel",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    let parsed: URL;
    try {
      parsed = new URL(params.url);
    } catch {
      throw new Error(`"${params.url}" is not a valid absolute URL.`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http and https URLs can be fetched.");
    }

    const page = await context.content.fetchPage(parsed.toString());
    const body = truncate(page.text, MAX_PAGE_CHARS);

    return textResult(
      `# ${page.title ?? parsed.hostname}\n<${page.url}>\n\n${body.text}`,
      { url: page.url, title: page.title, truncated: body.truncated }
    );
  },
});

export const retrievalTools: WritingTool[] = [
  searchPostsTool,
  getPostTool,
  listPostsTool,
  listTagsTool,
  fetchUrlTool,
];
