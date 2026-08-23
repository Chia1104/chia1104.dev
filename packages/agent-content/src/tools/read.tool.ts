import { StringEnum } from "@earendil-works/pi-ai";

import {
  LocaleSchema,
  Type,
  jsonBlock,
  textResult,
  toolDefiner,
} from "@chia/agent-runtime/tools";
import { buildDocumentContext } from "@chia/ai/embeddings/context";

import type { ContentTool, ContentToolContext } from "../types.ts";

import { CONTENT_TOOL_NAMES, CONTENT_TOOL_LABEL_BY_NAME } from "./registry.ts";

/**
 * Read-only grounding tools over the blog.
 *
 * All `executionMode: "parallel"`: they have no side effects, and the model routinely wants
 * several at once when orienting itself. Descriptions state what each tool returns; *when* to
 * reach for one is the kind's system prompt's job, because a writer and a reader use the same
 * tool for different reasons.
 */

const defineTool = toolDefiner<ContentToolContext>();

/**
 * Token budget for one `get_post` call, shared across the post's locales. Tokens rather than
 * characters: the same character count is ~3x the tokens in Chinese as in English, so a
 * character cap silently means different things.
 */
const POST_BODY_TOKEN_BUDGET = 12_000;

export const searchPostsTool = defineTool({
  name: CONTENT_TOOL_NAMES.searchPosts,
  label: CONTENT_TOOL_LABEL_BY_NAME[CONTENT_TOOL_NAMES.searchPosts],
  description:
    "Search posts. `semantic` matches on meaning (best for topics); `keyword` matches " +
    "on literal terms (best for names, APIs, error messages). Each hit's `headingPath` names the " +
    "section that matched — pass it to `get_post`'s `focusHeadings` to read that section first.",
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
      locale: params.locale,
      mode: params.mode === "keyword" ? "keyword" : "semantic",
      limit: params.limit ?? 5,
    });

    if (hits.length === 0) {
      return textResult(`No post matches "${params.keyword}".`, { hits: [] });
    }

    return textResult(
      `${hits.length} matching post(s):\n\n${jsonBlock(hits)}`,
      { hits }
    );
  },
});

export const getPostTool = defineTool({
  name: CONTENT_TOOL_NAMES.getPost,
  label: CONTENT_TOOL_LABEL_BY_NAME[CONTENT_TOOL_NAMES.getPost],
  description:
    "Read one post in full, including every locale's metadata and MDX body. Pass the `slug` " +
    "returned by `search_posts` or `list_posts`. Long bodies degrade to their matched sections " +
    "and then to an outline; each returned heading carries the anchor the site renders, so cite " +
    "`slug#anchor`.",
  parameters: Type.Object({
    slug: Type.String({
      description: "Post slug returned by `search_posts` or `list_posts`.",
      minLength: 1,
    }),
    locale: Type.Optional(
      LocaleSchema("Return only this locale. Omit for all locales.")
    ),
    focusHeadings: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Heading paths to keep first when the post is too long to return in full. Pass each " +
          "search hit's `headingPath` string unchanged, e.g. " +
          '`["Setup > Install", "Caveats"]`.',
      })
    ),
  }),
  executionMode: "parallel",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    const post = await context.content.getPost({
      slug: params.slug,
      locale: params.locale,
    });

    if (!post) {
      throw new Error(`No post found for slug "${params.slug}".`);
    }

    /**
     * One token budget shared by every locale of the post, rather than a per-locale character
     * cap. A 3-locale zh-TW post could otherwise be "within the limit" three times over and
     * still blow the context window, since Chinese costs far more tokens per character than the
     * character count suggests.
     */
    const context_ = await buildDocumentContext(
      post.translations.map((translation) => ({
        slug: post.slug,
        locale: translation.locale,
        title: translation.title,
        summary: translation.summary ?? translation.description,
        content: translation.content ?? "",
        // when the body degrades to sections, the ones the search matched survive first
        // instead of whichever happens to fit
        matchedHeadingPaths: params.focusHeadings,
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
  name: CONTENT_TOOL_NAMES.listPosts,
  label: CONTENT_TOOL_LABEL_BY_NAME[CONTENT_TOOL_NAMES.listPosts],
  description: "List recent posts, newest first.",
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
          "`true` for published only, `false` for drafts only. Omit for everything you can see.",
      })
    ),
  }),
  executionMode: "parallel",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    const posts = await context.content.listPosts({
      limit: params.limit ?? 20,
      published: params.published,
    });
    return textResult(`${posts.length} post(s):\n\n${jsonBlock(posts)}`, {
      posts,
    });
  },
});

export const listTagsTool = defineTool({
  name: CONTENT_TOOL_NAMES.listTags,
  label: CONTENT_TOOL_LABEL_BY_NAME[CONTENT_TOOL_NAMES.listTags],
  description: "List every tag with its localised names.",
  parameters: Type.Object({}),
  executionMode: "parallel",
  async execute(_toolCallId, _params, _signal, _onUpdate, context) {
    const tags = await context.content.listTags();
    return textResult(`${tags.length} tag(s):\n\n${jsonBlock(tags)}`, { tags });
  },
});

/** In the order a model should meet them: find, read, browse, classify. */
export const contentReadTools: ContentTool[] = [
  searchPostsTool,
  getPostTool,
  listPostsTool,
  listTagsTool,
];
