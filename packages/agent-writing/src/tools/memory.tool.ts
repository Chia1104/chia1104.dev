import { Type } from "typebox";

import { defineTool, jsonBlock, textResult } from "@chia/agent-runtime/tools";
import type { ToolSpec } from "@chia/agent-runtime/tools";
import { buildDocumentContext } from "@chia/ai/embeddings/context";
import { RERANK_ANSWERABLE_FLOOR } from "@chia/ai/rerank/provider";

import type {
  MemoryFreshness,
  MemoryHit,
  WritingToolContext,
} from "../types.ts";

import { TOOL_INFO_BY_NAME, TOOL_NAMES } from "./registry.ts";

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
  name: TOOL_NAMES.saveMemory,
  label: TOOL_INFO_BY_NAME[TOOL_NAMES.saveMemory].label,
  description:
    "Remember a verified fact for future sessions: a version number, an API signature, a " +
    "benchmark figure, a decision the operator made. Record the conclusion with its source, not " +
    "the page. Put code, signatures and type names in fenced code blocks. Pages you fetched are " +
    "remembered automatically; do not save them again.",
  parameters: Type.Object({
    title: Type.String({
      description: "One line naming the fact, as it should read in a list.",
      minLength: 1,
      maxLength: MAX_TITLE_CHARS,
    }),
    content: Type.String({
      description:
        "The fact itself in markdown, a few sentences at most. Include the exact figures, " +
        "names and versions; wrap code and signatures in fenced code blocks.",
      minLength: 1,
      maxLength: MAX_FACT_CHARS,
    }),
    sourceUrl: Type.Optional(
      Type.String({
        description:
          "Absolute http(s) URL of the page that establishes the fact. Omit only for facts that " +
          "have no web source, such as the operator's own decisions.",
        format: "uri",
      })
    ),
  }),
  executionMode: "parallel",
} satisfies ToolSpec;

export const saveMemoryTool = defineTool(
  saveMemorySpec,
  (context: WritingToolContext) => async (_toolCallId, params, signal) => {
    const saved = await context.memory.save(
      {
        kind: "fact",
        title: params.title,
        content: params.content,
        sourceUrl: params.sourceUrl,
      },
      signal
    );

    return textResult(
      `Saved memory #${saved.id}: ${saved.title}. Later sessions can find it with \`search_memory\`.`,
      {
        id: saved.id,
        kind: saved.kind,
        title: saved.title,
        sourceUrl: saved.sourceUrl,
      }
    );
  }
);

export const proposeLessonSpec = {
  name: TOOL_NAMES.proposeLesson,
  label: TOOL_INFO_BY_NAME[TOOL_NAMES.proposeLesson].label,
  description:
    "Propose a standing lesson for the operator to review: a preference about structure, " +
    "tone, length, sourcing or what to avoid that they stated, corrected you on, declined a " +
    "commit over, or that you noticed as a pattern across their edits, and that should apply " +
    "to every future post. It takes effect only once they approve it in the dashboard. Pass " +
    "`supersedes` only with an id from your context: a learned preference the feedback " +
    "contradicts, or a lesson this session already proposed that you are revising; the new " +
    "text replaces it entirely. Otherwise omit it. Not for facts (`save_memory`) or for " +
    "requests about this post alone.",
  parameters: Type.Object({
    title: Type.String({
      description:
        "One line stating the preference, as it should read in a list.",
      minLength: 1,
      maxLength: MAX_TITLE_CHARS,
    }),
    content: Type.String({
      description:
        "The preference in two or three sentences, in the operator's language: what to do, " +
        "when it applies, and what it replaces if anything.",
      minLength: 1,
      maxLength: MAX_LESSON_CHARS,
    }),
    supersedes: Type.Optional(
      Type.Integer({
        description:
          "Id of the learned preference this one replaces, or of the pending lesson this " +
          "session proposed and now revises, both from your context. Omit when neither applies.",
        minimum: 1,
      })
    ),
  }),
  executionMode: "parallel",
} satisfies ToolSpec;

export const proposeLessonTool = defineTool(
  proposeLessonSpec,
  (context: WritingToolContext) => async (_toolCallId, params, signal) => {
    const saved = await context.memory.save(
      {
        kind: "lesson",
        title: params.title,
        content: params.content,
        supersedesId: params.supersedes,
      },
      signal
    );

    return textResult(
      `Proposed lesson #${saved.id}: ${saved.title}. It applies once the operator approves it in the dashboard; tell them it is waiting for review.`,
      {
        id: saved.id,
        kind: saved.kind,
        title: saved.title,
        supersedes: params.supersedes ?? null,
      }
    );
  }
);

export const searchMemorySpec = {
  name: TOOL_NAMES.searchMemory,
  label: TOOL_INFO_BY_NAME[TOOL_NAMES.searchMemory].label,
  description:
    "Search what earlier sessions verified and read: saved facts and the full text of pages " +
    "fetched before. Distinct from `search_posts`, which searches the blog itself. Each hit " +
    "carries a memory id and every place in it that matched; pass the id and those " +
    "`headingPaths` to `get_memory`. `answerable` is how likely some hit answers the query; " +
    "when it is low, earlier sessions never covered this, so research it instead of stretching a hit.",
  parameters: Type.Object({
    query: Type.String({
      description: "Topic, name, API or claim to look for.",
      minLength: 1,
    }),
    limit: Type.Optional(
      Type.Integer({
        description: `Maximum hits (1-${MAX_SEARCH_LIMIT}).`,
        minimum: 1,
        maximum: MAX_SEARCH_LIMIT,
        default: DEFAULT_SEARCH_LIMIT,
      })
    ),
  }),
  executionMode: "parallel",
} satisfies ToolSpec;

export const searchMemoryTool = defineTool(
  searchMemorySpec,
  (context: WritingToolContext) => async (_toolCallId, params, signal) => {
    const { hits, answerable } = await context.memory.search(
      { query: params.query, limit: params.limit ?? DEFAULT_SEARCH_LIMIT },
      signal
    );

    if (hits.length === 0) {
      return textResult(
        `No memory matches "${params.query}". Nothing from earlier sessions covers this; research it with \`web_search\` and \`fetch_url\`.`,
        { query: params.query, hits: [], answerable }
      );
    }

    const note =
      answerable !== null && answerable < RERANK_ANSWERABLE_FLOOR
        ? `Earlier sessions probably never covered this (answerable ${answerable.toFixed(2)}); research it with \`web_search\` and \`fetch_url\` rather than stretching a hit.\n\n`
        : "";
    return textResult(
      `${note}${hits.length} memory hit(s) for "${params.query}":\n\n${hits.map(formatHit).join("\n\n")}`,
      { query: params.query, hits, answerable }
    );
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
  name: TOOL_NAMES.getMemory,
  label: TOOL_INFO_BY_NAME[TOOL_NAMES.getMemory].label,
  description:
    "Read one memory by the id a `search_memory` hit carries. A long page degrades to its " +
    "matched sections and then to an outline; pass the hit's `headingPath` as `focusHeadings` " +
    "so the section that matched is what survives.",
  parameters: Type.Object({
    id: Type.Integer({
      description: "Memory id from `search_memory`.",
      minimum: 1,
    }),
    focusHeadings: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Heading paths to keep first when the memory is too long to return in full. Pass " +
          "each match's `headingPaths` unchanged.",
      })
    ),
  }),
  executionMode: "parallel",
} satisfies ToolSpec;

export const getMemoryTool = defineTool(
  getMemorySpec,
  (context: WritingToolContext) => async (_toolCallId, params, signal) => {
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
          format: "markdown",
        },
      ],
      { budget: MEMORY_BODY_TOKEN_BUDGET }
    );
    const document = documents[0];
    const body = document?.text ?? content;
    const detail = document?.detail ?? "full";

    const freshness = freshnessNote(memory);
    return textResult(
      `# [${memory.kind}] ${memory.title}\n${memory.sourceUrl ? `<${memory.sourceUrl}>\n` : ""}` +
        `${freshness ? `${freshness}\n` : ""}` +
        `(${detail}, ${totalTokens} tokens)\n\n${body}\n\n${jsonBlock(meta)}`,
      { ...meta, detail, contentTokens: totalTokens }
    );
  }
);
