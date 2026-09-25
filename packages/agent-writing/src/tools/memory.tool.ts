import * as z from "zod";

import { defineTool, jsonBlock } from "@chia/agent-runtime/tools";
import type { ToolSpec } from "@chia/agent-runtime/tools";
import {
  ContextDetail,
  buildDocumentContext,
} from "@chia/ai/embeddings/context";
import { MarkdownFormat } from "@chia/ai/embeddings/markdown";
import { RERANK_ANSWERABLE_FLOOR } from "@chia/ai/rerank/provider";
import { AgentMemoryKind } from "@chia/db/schema";

import type {
  MemoryFreshness,
  MemoryHit,
  WritingToolContext,
} from "../types.ts";

import { ToolName } from "./registry.ts";

/**
 * `save_memory` writes a `fact`; `propose_lesson` writes a `lesson` that stays pending until
 * the operator approves it. A `source` is recorded by `fetch_url`. Retrieval is a tool so
 * cost is visible and the transcript shows what was drawn on.
 */

/** Small enough to force a distillation; a page goes through `fetch_url`, not here. */
const MAX_FACT_CHARS = 4_000;
const MAX_TITLE_CHARS = 200;
const MAX_LESSON_CHARS = 2_000;
const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 10;
/**
 * Token budget for one `get_memory`. A `source` is a whole page: past this it degrades to
 * matched sections, then an outline.
 */
const MEMORY_BODY_TOKEN_BUDGET = 8_000;

export const saveMemorySpec = {
  name: ToolName.SaveMemory,
  description:
    "Remember a verified fact for future sessions: a version number, an API signature, a " +
    "benchmark figure, a decision the operator made. Record the conclusion with its source, not " +
    "the page. Put code, signatures and type names in fenced code blocks. Pages you fetched are " +
    "remembered automatically; do not save them again.",
  parameters: z.object({
    title: z
      .string()
      .min(1)
      .max(MAX_TITLE_CHARS)
      .describe("One line naming the fact, as it should read in a list."),
    content: z
      .string()
      .min(1)
      .max(MAX_FACT_CHARS)
      .describe(
        "The fact itself in markdown, a few sentences at most. Include the exact figures, " +
          "names and versions; wrap code and signatures in fenced code blocks."
      ),
    sourceUrl: z
      .url()
      .describe(
        "Absolute http(s) URL of the page that establishes the fact. Omit only for facts that " +
          "have no web source, such as the operator's own decisions."
      )
      .optional(),
  }),
} satisfies ToolSpec;

export const saveMemoryTool = defineTool(
  saveMemorySpec,
  (context: WritingToolContext) =>
    async (params, { signal }) => {
      const saved = await context.memory.save(
        {
          kind: AgentMemoryKind.Fact,
          title: params.title,
          content: params.content,
          sourceUrl: params.sourceUrl,
        },
        signal
      );

      return {
        text: `Saved memory #${saved.id}: ${saved.title}. Later sessions can find it with \`search_memory\`.`,
        details: {
          id: saved.id,
          kind: saved.kind,
          title: saved.title,
          sourceUrl: saved.sourceUrl,
        },
      };
    }
);

export const proposeLessonSpec = {
  name: ToolName.ProposeLesson,
  description:
    "Propose a standing lesson for the operator to review: a preference about structure, " +
    "tone, length, sourcing or what to avoid that they stated, corrected you on, declined a " +
    "commit over, or that you noticed as a pattern across their edits, and that should apply " +
    "to every future post. It takes effect only once they approve it in the dashboard. Pass " +
    "`supersedes` only with an id from your context: a learned preference the feedback " +
    "contradicts, or a lesson this session already proposed that you are revising; the new " +
    "text replaces it entirely. Otherwise omit it. Not for facts (`save_memory`) or for " +
    "requests about this post alone.",
  parameters: z.object({
    title: z
      .string()
      .min(1)
      .max(MAX_TITLE_CHARS)
      .describe(
        "One line stating the preference, as it should read in a list."
      ),
    content: z
      .string()
      .min(1)
      .max(MAX_LESSON_CHARS)
      .describe(
        "The preference in two or three sentences, in the operator's language: what to do, " +
          "when it applies, and what it replaces if anything."
      ),
    supersedes: z
      .number()
      .int()
      .min(1)
      .describe(
        "Id of the learned preference this one replaces, or of the pending lesson this " +
          "session proposed and now revises, both from your context. Omit when neither applies."
      )
      .optional(),
  }),
} satisfies ToolSpec;

export const proposeLessonTool = defineTool(
  proposeLessonSpec,
  (context: WritingToolContext) =>
    async (params, { signal }) => {
      const saved = await context.memory.save(
        {
          kind: AgentMemoryKind.Lesson,
          title: params.title,
          content: params.content,
          supersedesId: params.supersedes,
        },
        signal
      );

      return {
        text: `Proposed lesson #${saved.id}: ${saved.title}. It applies once the operator approves it in the dashboard; tell them it is waiting for review.`,
        details: {
          id: saved.id,
          kind: saved.kind,
          title: saved.title,
          supersedes: params.supersedes ?? null,
        },
      };
    }
);

export const searchMemorySpec = {
  name: ToolName.SearchMemory,
  description:
    "Search what earlier sessions verified and read: saved facts and the full text of pages " +
    "fetched before. Distinct from `search_posts`, which searches the blog itself. Each hit " +
    "carries a memory id and every place in it that matched; pass the id and those " +
    "`headingPaths` to `get_memory`. `answerable` is how likely some hit answers the query; " +
    "when it is low, earlier sessions never covered this, so research it instead of stretching a hit.",
  parameters: z.object({
    query: z.string().min(1).describe("Topic, name, API or claim to look for."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_SEARCH_LIMIT)
      .meta({
        description: `Maximum hits (1-${MAX_SEARCH_LIMIT}).`,
        default: DEFAULT_SEARCH_LIMIT,
      })
      .optional(),
  }),
} satisfies ToolSpec;

export const searchMemoryTool = defineTool(
  searchMemorySpec,
  (context: WritingToolContext) =>
    async (params, { signal }) => {
      const { hits, answerable } = await context.memory.search(
        { query: params.query, limit: params.limit ?? DEFAULT_SEARCH_LIMIT },
        signal
      );

      if (hits.length === 0) {
        return {
          text: `No memory matches "${params.query}". Nothing from earlier sessions covers this; research it with \`web_search\` and \`fetch_url\`.`,
          details: { query: params.query, hits: [], answerable },
        };
      }

      const note =
        answerable !== null && answerable < RERANK_ANSWERABLE_FLOOR
          ? `Earlier sessions probably never covered this (answerable ${answerable.toFixed(2)}); research it with \`web_search\` and \`fetch_url\` rather than stretching a hit.\n\n`
          : "";
      return {
        text: `${note}${hits.length} memory hit(s) for "${params.query}":\n\n${hits.map(formatHit).join("\n\n")}`,
        details: { query: params.query, hits, answerable },
      };
    }
);

const formatHit = (hit: MemoryHit, index: number): string => {
  const heading = `${index + 1}. [${hit.kind}] **${hit.title}** (#${hit.id})`;
  const source = hit.sourceUrl ? `\n   <${hit.sourceUrl}>` : "";
  const freshness = freshnessNote(hit);
  const matches = hit.matches
    .map(
      (match) =>
        `\n   ${match.headingPaths.length > 0 ? `at: ${match.headingPaths.join(" | ")}\n   ` : ""}${match.snippet}`
    )
    .join("");
  return `${heading}${source}${freshness ? `\n   ${freshness}` : ""}${matches}`;
};

/** What a reader must know before trusting the memory to describe its page as it is now. */
const freshnessNote = (memory: MemoryFreshness): string | null => {
  if (memory.sourceChangedAt) {
    return `Its source page changed on ${memory.sourceChangedAt.slice(0, 10)}, after this fact was written: read the page again before relying on it.`;
  }
  return memory.fetchedAt
    ? `Fetched ${memory.fetchedAt.slice(0, 10)}; \`fetch_url\` again if the answer depends on the page being current.`
    : null;
};

export const getMemorySpec = {
  name: ToolName.GetMemory,
  description:
    "Read one memory by the id a `search_memory` hit carries. A long page degrades to its " +
    "matched sections and then to an outline; pass the hit's `headingPath` as `focusHeadings` " +
    "so the section that matched is what survives.",
  parameters: z.object({
    id: z.number().int().min(1).describe("Memory id from `search_memory`."),
    focusHeadings: z
      .array(z.string())
      .describe(
        "Heading paths to keep first when the memory is too long to return in full. Pass " +
          "each match's `headingPaths` unchanged."
      )
      .optional(),
  }),
} satisfies ToolSpec;

export const getMemoryTool = defineTool(
  getMemorySpec,
  (context: WritingToolContext) =>
    async (params, { signal }) => {
      const memory = await context.memory.get(params.id, signal);
      if (!memory) {
        throw new Error(
          `No memory #${params.id}. Use an id returned by search_memory.`
        );
      }

      const { content, ...meta } = memory;
      const { documents, totalTokens } = await buildDocumentContext(
        [
          {
            slug: String(memory.id),
            locale: "",
            title: memory.title,
            content,
            matchedHeadingPaths: params.focusHeadings,
            format: MarkdownFormat.Markdown,
          },
        ],
        { budget: MEMORY_BODY_TOKEN_BUDGET }
      );
      const document = documents[0];
      const body = document?.text ?? content;
      const detail = document?.detail ?? ContextDetail.Full;

      const freshness = freshnessNote(memory);
      return {
        text:
          `# [${memory.kind}] ${memory.title}\n${memory.sourceUrl ? `<${memory.sourceUrl}>\n` : ""}` +
          `${freshness ? `${freshness}\n` : ""}` +
          `(${detail}, ${totalTokens} tokens)\n\n${body}\n\n${jsonBlock(meta)}`,
        details: { ...meta, detail, contentTokens: totalTokens },
      };
    }
);
