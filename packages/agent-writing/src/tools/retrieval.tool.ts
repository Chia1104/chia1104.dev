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
 * Tier 1 — read-only grounding tools: the shared content read tools plus the outbound web
 * tools (`web_search`, `fetch_url`), which only the writing agent gets. Outbound requests are
 * a cost and an SSRF surface, acceptable for the operator's own authoring session and not for
 * a public one.
 */

const MAX_PAGE_CHARS = 16_000;
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
 * The content tools are typed over the narrower `ContentToolContext`; a `WritingToolContext`
 * satisfies it, so they slot into the writing tool set unchanged. Search precedes fetch so the
 * listing order matches the discover-then-read workflow.
 */
/**
 * Leaves a trail of every page read, keyed on its URL, so a later session can find it with
 * `search_memory`. Deterministic and model-free. Never fails the fetch: the model's result
 * is the same whether or not the trail was written, and a memory outage must not cost a
 * turn its research.
 *
 * The whole page as the model saw it, not an excerpt: the RAG pipeline is built for
 * documents — sections with heading paths, a card from the outline — and an excerpt only
 * ever bought recall on the page's first paragraph.
 */
const recordSource = async (
  context: WritingToolContext,
  page: FetchedPage,
  signal: AbortSignal | undefined
): Promise<void> => {
  const excerpt = page.text.trim().slice(0, MAX_PAGE_CHARS);
  if (excerpt.length === 0) return;
  try {
    await context.memory.save(
      {
        kind: "source",
        title: page.title?.trim() || hostnameOf(page.url),
        content: excerpt,
        sourceUrl: page.url,
      },
      signal
    );
  } catch (error) {
    console.error("Could not record a fetched page as a source memory", {
      url: page.url,
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

export const retrievalTools: WritingTool[] = [
  ...contentReadTools,
  webSearchTool,
  fetchUrlTool,
];
