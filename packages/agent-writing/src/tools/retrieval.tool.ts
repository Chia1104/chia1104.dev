import { StringEnum } from "@earendil-works/pi-ai";

import { contentReadTools } from "@chia/agent-content/tools/read";

import type {
  FetchedPage,
  WebSearchResult,
  WritingTool,
  WritingToolContext,
} from "../types.ts";
import { WEB_SEARCH_RECENCIES } from "../types.ts";

import { TOOL_NAMES, labelOf } from "./registry.ts";
import { Type, defineTool, textResult, truncate } from "./schema.ts";

/**
 * Shared content reads plus outbound web. Search and fetch are a cost and an SSRF surface,
 * for the author's session only.
 */

const MAX_PAGE_CHARS = 16_000;
/**
 * How much of a page a `source` memory keeps. The index chunks the whole thing, so a later
 * `search_memory` can land on a section this turn never looked at. Bounded so a pathological
 * page cannot become a megabyte row.
 */
const SOURCE_MAX_CHARS = 64_000;
const MAX_SEARCH_RESULTS = 10;
const DEFAULT_SEARCH_RESULTS = 5;
const MAX_SEARCH_DOMAINS = 5;

const normalizeSearchDomain = (input: string): string => {
  const domain = input.trim().toLowerCase().replace(/\.$/, "");
  let parsed: URL;
  try {
    parsed = new URL(`https://${domain}`);
  } catch {
    throw new Error(`"${input}" is not a valid hostname.`);
  }
  if (
    domain.length === 0 ||
    parsed.hostname !== domain ||
    parsed.port !== "" ||
    parsed.pathname !== "/" ||
    !domain.includes(".")
  ) {
    throw new Error(
      `"${input}" is not a bare hostname. Pass a domain such as "docs.example.com", without protocol or path.`
    );
  }
  return domain;
};

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
        "Topic or phrase to search for. Use `includeDomains` instead of embedding `site:` when restricting domains.",
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
    includeDomains: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Restrict results to these bare hostnames, without protocol or path. Prefer this over writing `site:` in the query.",
        minItems: 1,
        maxItems: MAX_SEARCH_DOMAINS,
      })
    ),
  }),
  executionMode: "parallel",
  async execute(_toolCallId, params, signal, _onUpdate, context) {
    const includeDomains = params.includeDomains?.map(normalizeSearchDomain);
    const results = await context.web.search(
      {
        query: params.query,
        limit: params.limit ?? DEFAULT_SEARCH_RESULTS,
        recency: params.recency,
        includeDomains,
      },
      signal
    );

    return textResult(
      results.length === 0
        ? `No results for "${params.query}"${
            includeDomains ? ` within ${includeDomains.join(", ")}` : ""
          }. If you know the official URL, call \`fetch_url\` directly. Otherwise retry once with a broader query${
            includeDomains ? " without the domain restriction" : ""
          }; do not repeat the same search.`
        : `${results.length} result(s) for "${params.query}":\n\n${results.map(formatResult).join("\n\n")}`,
      {
        query: params.query,
        count: results.length,
        results,
        includeDomains,
        recency: params.recency,
      }
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
  async execute(_toolCallId, params, signal, _onUpdate, context) {
    let parsed: URL;
    try {
      parsed = new URL(params.url);
    } catch {
      throw new Error(`"${params.url}" is not a valid absolute URL.`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http and https URLs can be fetched.");
    }

    const page = await context.web.fetchPage(parsed.toString(), signal);
    const body = truncate(page.text, MAX_PAGE_CHARS);

    await recordSource(context, page, signal);

    return textResult(
      `# ${page.title ?? parsed.hostname}\n<${page.url}>\n\n${body.text}`,
      { url: page.url, title: page.title, truncated: body.truncated }
    );
  },
});

/**
 * Records every fetched page as a `source`, keyed on URL. Never fails the fetch: a memory
 * outage must not cost the turn its research. Stores the whole page, not an excerpt: RAG
 * recalls by section, and an excerpt only ever bought the first paragraph.
 */
const recordSource = async (
  context: WritingToolContext,
  page: FetchedPage,
  signal: AbortSignal | undefined
): Promise<void> => {
  const text = page.text.trim().slice(0, SOURCE_MAX_CHARS);
  if (text.length === 0) return;
  try {
    await context.memory.save(
      {
        kind: "source",
        title: page.title?.trim() || hostnameOf(page.url),
        content: text,
        sourceUrl: page.url,
      },
      signal
    );
  } catch (error) {
    // origin and path only: a query string may carry a signed token or a personal id
    console.error("Could not record a fetched page as a source memory", {
      page: pageLocationOf(page.url),
      error: String(error),
    });
  }
};

const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const pageLocationOf = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "(unparseable url)";
  }
};

export const retrievalTools: WritingTool[] = [
  ...contentReadTools,
  webSearchTool,
  fetchUrlTool,
];
