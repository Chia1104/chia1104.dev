import { Firecrawl, SdkError } from "firecrawl";
import type { Document, SearchResultWeb } from "firecrawl";
import { parse as parseHTML } from "node-html-parser";

import type {
  FetchedPage,
  WebPort,
  WebSearchInput,
  WebSearchRecency,
  WebSearchResult,
} from "@chia/agent-writing/ports";
import request from "@chia/utils/request";

import { env } from "../env";

/**
 * {@link WebPort} implementation: Firecrawl search for discovery, a bounded direct fetch for
 * reading a page.
 *
 * Search returns snippets only — no `scrapeOptions` — so a call costs a fixed two credits per
 * ten results and the model reads a page only when it decides to via `fetch_url`.
 */

const SEARCH_TIMEOUT_MS = 30_000;

/** Firecrawl's `tbs` accepts Google's time-restrict codes. */
const TBS_BY_RECENCY = {
  day: "qdr:d",
  week: "qdr:w",
  month: "qdr:m",
  year: "qdr:y",
} satisfies Record<WebSearchRecency, string>;

const firecrawl = new Firecrawl({ apiKey: env.FIRECRAWL_API_KEY });

/**
 * A `web` hit is `SearchResultWeb` unless scraping was requested, in which case it is a
 * `Document`. This port never scrapes, but the SDK type is the union.
 */
const toSearchResult = (
  hit: SearchResultWeb | Document
): WebSearchResult | undefined => {
  if ("url" in hit) {
    return { url: hit.url, title: hit.title, description: hit.description };
  }
  const url = hit.metadata?.sourceURL ?? hit.metadata?.url;
  return url
    ? {
        url,
        title: hit.metadata?.title,
        description: hit.metadata?.description,
      }
    : undefined;
};

const searchWeb = async (input: WebSearchInput): Promise<WebSearchResult[]> => {
  let data;
  try {
    data = await firecrawl.search(input.query, {
      limit: input.limit,
      tbs: input.recency ? TBS_BY_RECENCY[input.recency] : undefined,
      sources: ["web"],
      timeout: SEARCH_TIMEOUT_MS,
    });
  } catch (error) {
    // The SDK message carries the provider's response body; the model needs the status only.
    if (error instanceof SdkError) {
      throw new Error(
        `Web search failed${error.status ? ` (HTTP ${error.status})` : ""}.`
      );
    }
    throw error;
  }

  return (data.web ?? []).flatMap((hit) => {
    const result = toSearchResult(hit);
    return result ? [result] : [];
  });
};

const MAX_PAGE_CHARS = 200_000;

/** Byte cap for a fetched page; `MAX_PAGE_CHARS` alone caps only after the full download. */
const MAX_PAGE_BYTES = 2 * 1024 * 1024;

/**
 * Reads the body incrementally and stops at the cap, so a huge (or unbounded) response
 * costs at most `MAX_PAGE_BYTES` of memory instead of being buffered whole before the
 * `MAX_PAGE_CHARS` slice.
 */
const readBoundedText = async (response: Response): Promise<string> => {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;

  while (bytes < MAX_PAGE_BYTES && text.length < MAX_PAGE_CHARS) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }

  await reader.cancel().catch(() => undefined);
  return text.slice(0, MAX_PAGE_CHARS);
};

const fetchPage = async (url: string): Promise<FetchedPage> => {
  const response = await request({
    headers: { Accept: "text/html,application/xhtml+xml" },
  }).get(url);
  const html = await readBoundedText(response);

  // Matches `toolings.route.ts` — a parser, not a DOM. jsdom cost ~110MB RSS on import and
  // never gave it back; all this needs is selectors and text.
  const document = parseHTML(html);

  for (const selector of ["script", "style", "noscript", "svg"]) {
    for (const node of document.querySelectorAll(selector)) node.remove();
  }

  /**
   * `document` itself is the last fallback, not `body`.
   *
   * jsdom parsed into a full document and synthesised a `<body>` even for a bare fragment.
   * A parser does not, so a response with no `<body>` wrapper would otherwise select nothing
   * and hand the model an empty page.
   */
  const main =
    document.querySelector("article") ??
    document.querySelector("main") ??
    document.querySelector("body") ??
    document;

  return {
    url,
    title: document.querySelector("title")?.textContent ?? undefined,
    // Collapse the whitespace the parser preserves; the model does not benefit from blank lines.
    text: (main?.textContent ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n"),
  };
};

export const createAgentWebPort = (): WebPort => ({
  search: searchWeb,
  fetchPage,
});
