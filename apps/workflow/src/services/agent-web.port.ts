import { Firecrawl, SdkError } from "firecrawl";
import type { Document, SearchData, SearchResultWeb } from "firecrawl";

import type {
  FetchedPage,
  WebPort,
  WebSearchInput,
  WebSearchRecency,
  WebSearchResult,
} from "@chia/agent-writing/ports";
import { untilAborted } from "@chia/utils/request/abort";

import { env } from "../env";

/**
 * {@link WebPort} implementation on Firecrawl: `search` for discovery, `scrape` to read a page.
 *
 * Search returns snippets only — no `scrapeOptions` — so a call costs a fixed two credits per
 * ten results and the model reads a page only when it decides to via `fetch_url`, which is one
 * scrape per page (plus per-page cost for PDFs).
 */

const REQUEST_TIMEOUT_MS = 30_000;

/** Firecrawl's `tbs` accepts Google's time-restrict codes. */
const TBS_BY_RECENCY = {
  day: "qdr:d",
  week: "qdr:w",
  month: "qdr:m",
  year: "qdr:y",
} satisfies Record<WebSearchRecency, string>;

const firecrawl = new Firecrawl({ apiKey: env.FIRECRAWL_API_KEY });

/** The SDK message carries the provider's response body; the model needs the status only. */
const toModelError = (operation: string, error: SdkError): Error =>
  new Error(
    `${operation} failed${error.status ? ` (HTTP ${error.status})` : ""}.`
  );

/**
 * A `web` hit is `SearchResultWeb` unless scraping was requested, in which case it is a
 * `Document`. This port never scrapes on search, but the SDK type is the union.
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

const search = async (
  input: WebSearchInput,
  signal?: AbortSignal
): Promise<WebSearchResult[]> => {
  let data: SearchData;
  try {
    data = await untilAborted(
      firecrawl.search(input.query, {
        limit: input.limit,
        tbs: input.recency ? TBS_BY_RECENCY[input.recency] : undefined,
        includeDomains: input.includeDomains,
        sources: ["web"],
        timeout: REQUEST_TIMEOUT_MS,
      }),
      signal
    );
  } catch (error) {
    throw error instanceof SdkError ? toModelError("Web search", error) : error;
  }

  return (data.web ?? []).flatMap((hit) => {
    const result = toSearchResult(hit);
    return result ? [result] : [];
  });
};

const fetchPage = async (
  url: string,
  signal?: AbortSignal
): Promise<FetchedPage> => {
  let document: Omit<Document, "json">;
  try {
    document = await untilAborted(
      firecrawl.scrape(url, {
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: REQUEST_TIMEOUT_MS,
      }),
      signal
    );
  } catch (error) {
    throw error instanceof SdkError
      ? toModelError("Fetching the page", error)
      : error;
  }

  return {
    url: document.metadata?.sourceURL ?? url,
    title: document.metadata?.title,
    text: document.markdown ?? "",
  };
};

export const createAgentWebPort = (): WebPort => ({ search, fetchPage });
