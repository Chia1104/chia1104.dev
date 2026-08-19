import { StringEnum } from "@earendil-works/pi-ai";

import { contentReadTools } from "@chia/agent-content/tools/read";

import type { WebSearchResult, WritingTool } from "../types.ts";
import { WEB_SEARCH_RECENCIES } from "../types.ts";

import { TOOL_NAMES, labelOf } from "./registry.ts";
import { Type, defineTool, textResult, truncate } from "./schema.ts";

/**
 * Tier 1 — read-only grounding tools: the shared content read tools plus the outbound web
 * tools (`web_search`, `fetch_url`), which only the writing agent gets. Outbound requests are
 * a cost and an SSRF surface, acceptable for the operator's own authoring session and not for
 * a public one.
 */

const MAX_PAGE_CHARS = 16_000;
const MAX_SEARCH_RESULTS = 10;
const DEFAULT_SEARCH_RESULTS = 5;

export const webSearchTool = defineTool({
  name: TOOL_NAMES.webSearch,
  label: labelOf(TOOL_NAMES.webSearch),
  description:
    "Search the web and return result titles, URLs and snippets. Use it to discover a primary " +
    "source (official docs, release notes, the repository) before reading it with `fetch_url`; " +
    "snippets alone are not enough to verify a claim.",
  parameters: Type.Object({
    query: Type.String({
      description:
        "Search query. Search-engine operators such as `site:` are supported.",
      minLength: 1,
    }),
    limit: Type.Optional(
      Type.Integer({
        description: `Maximum results (1-${MAX_SEARCH_RESULTS}).`,
        minimum: 1,
        maximum: MAX_SEARCH_RESULTS,
        default: DEFAULT_SEARCH_RESULTS,
      })
    ),
    recency: Type.Optional(
      StringEnum([...WEB_SEARCH_RECENCIES], {
        description:
          "Only results published within this window. Omit for no time filter.",
      })
    ),
  }),
  executionMode: "parallel",
  async execute(_toolCallId, params, _signal, _onUpdate, context) {
    const results = await context.web.search({
      query: params.query,
      limit: params.limit ?? DEFAULT_SEARCH_RESULTS,
      recency: params.recency,
    });

    return textResult(
      results.length === 0
        ? `No results for "${params.query}".`
        : `${results.length} result(s) for "${params.query}":\n\n${results.map(formatResult).join("\n\n")}`,
      { query: params.query, count: results.length, results }
    );
  },
});

const formatResult = (result: WebSearchResult, index: number): string => {
  const heading = `${index + 1}. **${result.title ?? result.url}**\n   <${result.url}>`;
  return result.description ? `${heading}\n   ${result.description}` : heading;
};

export const fetchUrlTool = defineTool({
  name: TOOL_NAMES.fetchUrl,
  label: labelOf(TOOL_NAMES.fetchUrl),
  description:
    "Fetch a public web page (or PDF) and return its main content as markdown. Use it to " +
    "check a fact or read a reference the operator linked.",
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

    const page = await context.web.fetchPage(parsed.toString());
    const body = truncate(page.text, MAX_PAGE_CHARS);

    return textResult(
      `# ${page.title ?? parsed.hostname}\n<${page.url}>\n\n${body.text}`,
      { url: page.url, title: page.title, truncated: body.truncated }
    );
  },
});

/**
 * The content tools are typed over the narrower `ContentToolContext`; a `WritingToolContext`
 * satisfies it, so they slot into the writing tool set unchanged. Search precedes fetch so the
 * listing order matches the discover-then-read workflow.
 */
export const retrievalTools: WritingTool[] = [
  ...contentReadTools,
  webSearchTool,
  fetchUrlTool,
];
