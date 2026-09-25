import * as z from "zod";

import { defineTool, jsonBlock } from "@chia/agent-runtime/tools";
import type {
  AgentTool,
  ToolFactory,
  ToolSpec,
} from "@chia/agent-runtime/tools";
import { buildDocumentContext } from "@chia/ai/embeddings/context";
import { RERANK_ANSWERABLE_FLOOR } from "@chia/ai/rerank/provider";
import { Locale } from "@chia/db/types";
import { FeedType } from "@chia/db/types";

import type { ContentToolContext } from "../types.ts";

import { ContentToolName } from "./registry.ts";

/**
 * Read-only content tools. Descriptions state what each tool returns; when to reach for one is
 * the kind's system prompt.
 */

/**
 * Token budget for one `get_post` call, shared across the post's locales. Tokens rather than
 * characters: the same character count is ~3x the tokens in Chinese as in English.
 */
export const POST_BODY_TOKEN_BUDGET = 12_000;

/** Prefixes the hit list when the reranker doubts any hit answers; the hits still follow. */
export const answerableNote = (answerable: number | null): string =>
  answerable !== null && answerable < RERANK_ANSWERABLE_FLOOR
    ? `The posts probably do not cover this (answerable ${answerable.toFixed(2)}); say so rather than stretching a hit.\n\n`
    : "";

export const searchPostsSpec = {
  name: ContentToolName.SearchPosts,
  description:
    "Search posts. `semantic` matches on meaning (best for topics); `keyword` matches " +
    "on literal terms (best for names, APIs, error messages). Each hit's `matches` are the places " +
    "in that post that matched, best first — pass their `headingPaths` to `get_post`'s " +
    "`focusHeadings` to read those sections first, rather than searching again for the same post. " +
    "Each hit's `url` is the post's page; link with it as given. `answerable` is how likely some " +
    "hit answers the query; when it is low the posts do not cover this, so say so rather than " +
    "stretching a hit.",
  parameters: z.object({
    keyword: z.string().min(1).describe("The topic or phrase to look for."),
    // Optional, not required-with-a-default: the `default` is documentation for the model, it
    // does not make a field optional, and a required field the model must always restate is
    // pure friction. `execute` falls back to semantic.
    mode: z
      .enum(["semantic", "keyword"])
      .meta({
        description:
          "`semantic` (default) for conceptual similarity, `keyword` for literal term matching.",
        default: "semantic",
      })
      .optional(),
    locale: z
      .enum(Locale)
      .describe("Restrict to one locale. Omit to search all.")
      .optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .meta({
        description: "Maximum results (1-20).",
        default: 5,
      })
      .optional(),
  }),
} satisfies ToolSpec;

export const searchPostsTool = defineTool(
  searchPostsSpec,
  (context: ContentToolContext) => async (params) => {
    const { hits, answerable } = await context.content.searchPosts({
      keyword: params.keyword,
      locale: params.locale,
      mode: params.mode === "keyword" ? "keyword" : "semantic",
      limit: params.limit ?? 5,
    });

    if (hits.length === 0) {
      return {
        text: `No post matches "${params.keyword}".`,
        details: {
          hits: [],
          answerable,
        },
      };
    }

    return {
      text: `${answerableNote(answerable)}${hits.length} matching post(s):\n\n${jsonBlock(hits)}`,
      details: { hits, answerable },
    };
  }
);

export const getPostSpec = {
  name: ContentToolName.GetPost,
  description:
    "Read one post in full, including every locale's metadata and MDX body. Pass the `slug` " +
    "returned by `search_posts` or `list_posts`. Long bodies degrade to their matched sections " +
    "and then to an outline; each returned heading carries the anchor the site renders, so cite " +
    "`url#anchor` with the translation's `url` as given. Never assemble a link from the slug.",
  parameters: z.object({
    slug: z
      .string()
      .min(1)
      .describe("Post slug returned by `search_posts` or `list_posts`."),
    locale: z
      .enum(Locale)
      .describe("Return only this locale. Omit for all locales.")
      .optional(),
    focusHeadings: z
      .array(z.string())
      .describe(
        "Heading paths to keep first when the post is too long to return in full. Pass each " +
          "search match's `headingPaths` strings unchanged, e.g. " +
          '`["Setup > Install", "Caveats"]`.'
      )
      .optional(),
  }),
} satisfies ToolSpec;

export const getPostTool = defineTool(
  getPostSpec,
  (context: ContentToolContext) => async (params) => {
    const post = await context.content.getPost({
      slug: params.slug,
      locale: params.locale,
    });

    if (!post) {
      throw new Error(`No post found for slug "${params.slug}".`);
    }

    /**
     * One token budget shared by every locale of the post, rather than a per-locale character
     * cap. A 3-locale zh-TW post could otherwise be "within the limit" three times over.
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

    return {
      text: `Post "${post.slug}" (${context_.totalTokens} tokens of ${context_.budget}):\n\n${jsonBlock(
        { ...post, translations }
      )}`,
      details: {
        post: { ...post, translations },
        contextTokens: context_.totalTokens,
      },
    };
  }
);

export const listPostsSpec = {
  name: ContentToolName.ListPosts,
  description:
    "List posts and notes by publication date, newest first, with `total`: how many match in " +
    "all, beyond the `limit` returned. Filter by type, tag or date range to enumerate or count " +
    '("how many posts in 2025", "everything tagged react"); search ranks by relevance and ' +
    "cannot do either. Each post carries the `url` of its page; link with it as given.",
  parameters: z.object({
    type: z
      .enum([FeedType.Post, FeedType.Note])
      .describe("Only posts or only notes. Omit for both.")
      .optional(),
    tag: z.string().min(1).describe("Tag slug from `list_tags`.").optional(),
    createdFrom: z.iso
      .date()
      .describe(
        "Only posts created at or after this ISO date, e.g. `2025-01-01`."
      )
      .optional(),
    createdBefore: z.iso
      .date()
      .describe("Only posts created before this ISO date, e.g. `2026-01-01`.")
      .optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .meta({
        description: "Maximum results (1-50).",
        default: 20,
      })
      .optional(),
    published: z
      .boolean()
      .describe(
        "`true` for published only, `false` for drafts only. Omit for everything you can see."
      )
      .optional(),
  }),
} satisfies ToolSpec;

export const listPostsTool = defineTool(
  listPostsSpec,
  (context: ContentToolContext) => async (params) => {
    const { posts, total } = await context.content.listPosts({
      limit: params.limit ?? 20,
      published: params.published,
      type: params.type,
      tagSlug: params.tag,
      createdFrom: params.createdFrom,
      createdBefore: params.createdBefore,
    });
    return {
      text: `${posts.length} of ${total} matching post(s):\n\n${jsonBlock(posts)}`,
      details: { posts, total },
    };
  }
);

export const listTagsSpec = {
  name: ContentToolName.ListTags,
  description: "List every tag with its localised names.",
  parameters: z.object({}),
} satisfies ToolSpec;

export const listTagsTool = defineTool(
  listTagsSpec,
  (context: ContentToolContext) => async () => {
    const tags = await context.content.listTags();
    return {
      text: `${tags.length} tag(s):\n\n${jsonBlock(tags)}`,
      details: { tags },
    };
  }
);

/** Order is the order the model sees the tools in. */
export const contentReadTools: readonly ToolFactory<ContentToolContext>[] = [
  searchPostsTool,
  getPostTool,
  listPostsTool,
  listTagsTool,
];

export const contentReadToolSpecs: ToolSpec[] = contentReadTools.map(
  (tool) => tool.spec
);

export const createContentReadTools = (
  context: ContentToolContext
): AgentTool[] => contentReadTools.map((tool) => tool(context));
