import { buildDocumentContext } from "@chia/ai/embeddings/context";

import type { MemoryHit } from "../types.ts";
import type { WritingTool } from "../types.ts";

import { TOOL_NAMES, labelOf } from "./registry.ts";
import { Type, defineTool, jsonBlock, textResult } from "./schema.ts";

/**
 * Long-term memory across sessions.
 *
 * `save_memory` writes a `fact` only. A `source` is recorded automatically by `fetch_url`,
 * and a `lesson` is extracted from the operator's feedback by a workflow and reviewed before
 * it takes effect — neither is something the model should author by hand.
 *
 * Retrieval is a tool rather than an automatic lookup on every request so the cost is
 * visible (one call, one search) and the transcript shows what the agent drew on.
 */

/** Small enough to force a distillation; a page goes through `fetch_url`, not here. */
const MAX_FACT_CHARS = 4_000;
const MAX_TITLE_CHARS = 200;
const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 10;
/**
 * Token budget for one `get_memory`. A `source` is a whole page; `buildDocumentContext`
 * lets one document take 60% of this, so a 16k-character English page returns in full and a
 * Chinese one degrades to its matched sections, then to an outline — as `get_post` does.
 */
const MEMORY_BODY_TOKEN_BUDGET = 8_000;

export const saveMemoryTool = defineTool({
  name: TOOL_NAMES.saveMemory,
  label: labelOf(TOOL_NAMES.saveMemory),
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
  async execute(_toolCallId, params, signal, _onUpdate, context) {
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
  },
});

export const searchMemoryTool = defineTool({
  name: TOOL_NAMES.searchMemory,
  label: labelOf(TOOL_NAMES.searchMemory),
  description:
    "Search what earlier sessions verified and read: saved facts and the full text of pages " +
    "fetched before. Distinct from `search_posts`, which searches the blog itself. Each hit " +
    "carries a memory id and the heading that matched; pass both to `get_memory`.",
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
  async execute(_toolCallId, params, signal, _onUpdate, context) {
    const hits = await context.memory.search(
      { query: params.query, limit: params.limit ?? DEFAULT_SEARCH_LIMIT },
      signal
    );

    if (hits.length === 0) {
      return textResult(
        `No memory matches "${params.query}". Nothing from earlier sessions covers this; research it with \`web_search\` and \`fetch_url\`.`,
        { query: params.query, hits: [] }
      );
    }

    return textResult(
      `${hits.length} memory hit(s) for "${params.query}":\n\n${hits.map(formatHit).join("\n\n")}`,
      { query: params.query, hits }
    );
  },
});

const formatHit = (hit: MemoryHit, index: number): string => {
  const heading = `${index + 1}. [${hit.kind}] **${hit.title}** (#${hit.id})`;
  const source = hit.sourceUrl ? `\n   <${hit.sourceUrl}>` : "";
  const path = hit.headingPath ? `\n   at: ${hit.headingPath}` : "";
  return `${heading}${source}${path}\n   ${hit.snippet}`;
};

export const getMemoryTool = defineTool({
  name: TOOL_NAMES.getMemory,
  label: labelOf(TOOL_NAMES.getMemory),
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
          "each hit's `headingPath` unchanged.",
      })
    ),
  }),
  executionMode: "parallel",
  async execute(_toolCallId, params, signal, _onUpdate, context) {
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
        },
      ],
      { budget: MEMORY_BODY_TOKEN_BUDGET }
    );
    const document = documents[0];
    const body = document?.text ?? content;
    const detail = document?.detail ?? "full";

    return textResult(
      `# [${memory.kind}] ${memory.title}\n${memory.sourceUrl ? `<${memory.sourceUrl}>\n` : ""}` +
        `(${detail}, ${totalTokens} tokens)\n\n${body}\n\n${jsonBlock(meta)}`,
      { ...meta, detail, contentTokens: totalTokens }
    );
  },
});

export const memoryTools: WritingTool[] = [
  searchMemoryTool,
  getMemoryTool,
  saveMemoryTool,
];
