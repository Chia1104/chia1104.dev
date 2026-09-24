import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

import { WebSearchRecency } from "@chia/agent-content/types";
import type { FetchedPage, WebSearchResult } from "@chia/agent-content/types";
import {
  defineTool,
  optional,
  textResult,
  truncate,
} from "@chia/agent-runtime/tools";
import type { ToolSpec } from "@chia/agent-runtime/tools";
import { MarkdownFormat, splitByHeadings } from "@chia/ai/embeddings/markdown";
import { AgentMemoryKind } from "@chia/db/schema";
import { reportError } from "@chia/observability/report";

import { closeOpenFence } from "../markdown/fences.ts";
import type { WritingToolContext } from "../types.ts";

import { TOOL_INFO_BY_NAME, ToolName } from "./registry.ts";

/**
 * Shared content reads plus outbound web. Search and fetch are a cost and an SSRF surface,
 * for the author's session only.
 */

const MAX_PAGE_CHARS = 16_000;
/**
 * How much of a page a `source` memory keeps; `MEMORY_CONTENT_MAX_CHARS` in the memory service
 * is the same bound and rejects anything longer. The index chunks the whole thing, so a later
 * `search_memory` can land on a section this turn never looked at. Bounded so a pathological
 * page cannot become a megabyte row.
 */
const SOURCE_MAX_CHARS = 256_000;
/** Heading paths listed after a cut; a page with more is reached through `search_memory`. */
const MAX_UNREAD_HEADINGS = 40;
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

export const webSearchSpec = {
  name: ToolName.WebSearch,
  label: TOOL_INFO_BY_NAME[ToolName.WebSearch].label,
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
    limit: optional(
      Type.Integer({
        description: `Maximum results (1-${MAX_SEARCH_RESULTS}).`,
        minimum: 1,
        maximum: MAX_SEARCH_RESULTS,
        default: DEFAULT_SEARCH_RESULTS,
      })
    ),
    recency: optional(
      StringEnum(Object.values(WebSearchRecency), {
        description:
          "Only results published within this window. Omit for no time filter.",
      })
    ),
    includeDomains: optional(
      Type.Array(Type.String(), {
        description:
          "Restrict results to these bare hostnames, without protocol or path. Prefer this over writing `site:` in the query.",
        minItems: 1,
        maxItems: MAX_SEARCH_DOMAINS,
      })
    ),
  }),
  executionMode: "parallel",
} satisfies ToolSpec;

export const webSearchTool = defineTool(
  webSearchSpec,
  (context: WritingToolContext) => async (_toolCallId, params, signal) => {
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
  }
);

const formatResult = (result: WebSearchResult, index: number): string => {
  const heading = `${index + 1}. **${result.title ?? result.url}**\n   <${result.url}>`;
  return result.description ? `${heading}\n   ${result.description}` : heading;
};

export const fetchUrlSpec = {
  name: ToolName.FetchUrl,
  label: TOOL_INFO_BY_NAME[ToolName.FetchUrl].label,
  description:
    "Fetch a public web page (or PDF) and return its main content as markdown. Use it to " +
    "check a fact or read a reference the operator linked. A long page is cut; the result then " +
    "names the memory that holds the page and the sections past the cut. Read those with " +
    "`get_memory`, not by fetching the URL again.",
  parameters: Type.Object({
    url: Type.String({
      description: "Absolute http(s) URL.",
      format: "uri",
    }),
  }),
  executionMode: "parallel",
} satisfies ToolSpec;

export const fetchUrlTool = defineTool(
  fetchUrlSpec,
  (context: WritingToolContext) => async (_toolCallId, params, signal) => {
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

    const source = await recordSource(context, page, signal);
    const unread =
      body.truncated && source
        ? await unreadHeadings(source.text, MAX_PAGE_CHARS)
        : [];

    return textResult(
      `# ${page.title ?? parsed.hostname}\n<${page.url}>\n\n${body.text}${
        body.truncated && source ? continuationNote(source.id, unread) : ""
      }`,
      {
        url: page.url,
        title: page.title,
        truncated: body.truncated,
        memoryId: source?.id,
        unreadHeadings: unread,
      }
    );
  }
);

/**
 * Heading paths of the sections at and past `shownChars`, as `get_memory`'s `focusHeadings`
 * matches them. The section the cut fell in is included: its tail was not shown.
 */
const unreadHeadings = async (
  text: string,
  shownChars: number
): Promise<string[]> => {
  const [all, shown] = await Promise.all([
    splitByHeadings(text, MarkdownFormat.Markdown),
    splitByHeadings(text.slice(0, shownChars), MarkdownFormat.Markdown),
  ]);
  const paths = all
    .slice(Math.max(shown.length - 1, 0))
    .map((section) => section.headingPath)
    .filter((path): path is string => path !== null);
  return [...new Set(paths)].slice(0, MAX_UNREAD_HEADINGS);
};

const continuationNote = (memoryId: number, unread: string[]): string =>
  unread.length > 0
    ? `\n\nThe page is saved as memory #${memoryId}. Sections not fully shown above, to pass to ` +
      `\`get_memory\` as \`focusHeadings\`:\n${unread.map((path) => `- ${path}`).join("\n")}`
    : `\n\nThe page is saved as memory #${memoryId}; \`search_memory\` finds passages past the cut.`;

/**
 * Records every fetched page as a `source`, keyed on URL. Never fails the fetch: a memory
 * outage must not cost the turn its research. Stores the whole page, not an excerpt: RAG
 * recalls by section, and an excerpt only ever bought the first paragraph.
 */
const recordSource = async (
  context: WritingToolContext,
  page: FetchedPage,
  signal: AbortSignal | undefined
): Promise<{ id: number; text: string } | null> => {
  const trimmed = page.text.trim();
  const text =
    trimmed.length > SOURCE_MAX_CHARS
      ? cutWithinFences(trimmed, SOURCE_MAX_CHARS)
      : trimmed;
  if (text.length === 0) return null;
  try {
    const saved = await context.memory.save(
      {
        kind: AgentMemoryKind.Source,
        title: page.title?.trim() || hostnameOf(page.url),
        content: text,
        sourceUrl: page.url,
      },
      signal
    );
    return { id: saved.id, text };
  } catch (error) {
    // origin and path only: a query string may carry a signed token or a personal id
    reportError(error, "Could not record a fetched page as a source memory", {
      page: pageLocationOf(page.url),
    });
    return null;
  }
};

/**
 * A cut inside a code fence would turn the rest of the page into code, so the fence is closed;
 * the cut moves back by what closing added, keeping the result within `maxChars`.
 */
const cutWithinFences = (text: string, maxChars: number): string => {
  const closed = closeOpenFence(text.slice(0, maxChars));
  const overflow = closed.length - maxChars;
  return overflow > 0
    ? closeOpenFence(text.slice(0, maxChars - overflow))
    : closed;
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
