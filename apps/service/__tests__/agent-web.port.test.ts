const { search, scrape } = vi.hoisted(() => ({
  search: vi.fn(),
  scrape: vi.fn(),
}));

vi.mock("firecrawl", () => {
  class SdkError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  }
  class Firecrawl {
    search = search;
    scrape = scrape;
  }
  return { Firecrawl, SdkError };
});

import { SdkError } from "firecrawl";

import { createAgentWebPort } from "../src/services/agent-web.port";

/**
 * The port is the only place Firecrawl's request and response shapes are known. These pin the
 * mapping the tools rely on: recency → `tbs`, no `scrapeOptions` on search (cost), hits reduced
 * to `{ url, title, description }` whichever shape the SDK returns, and a scrape reduced to
 * `{ url, title, text }`.
 */

describe("createAgentWebPort.search", () => {
  const port = createAgentWebPort();

  beforeEach(() => {
    search.mockReset();
  });

  it("sends the query with limit, recency as tbs, web source only and no scrape", async () => {
    search.mockResolvedValue({ web: [] });

    await port.search({
      query: "hono v5 release",
      limit: 3,
      recency: "week",
      includeDomains: ["hono.dev"],
    });

    expect(search).toHaveBeenCalledWith("hono v5 release", {
      limit: 3,
      tbs: "qdr:w",
      includeDomains: ["hono.dev"],
      sources: ["web"],
      timeout: 30_000,
    });
    expect(search.mock.calls[0]?.[1]).not.toHaveProperty("scrapeOptions");
  });

  it("omits tbs when no recency is given", async () => {
    search.mockResolvedValue({ web: [] });

    await port.search({ query: "q", limit: 5 });

    expect(search.mock.calls[0]?.[1]).toMatchObject({
      tbs: undefined,
      includeDomains: undefined,
    });
  });

  it("maps web hits and scraped documents to url, title and description", async () => {
    search.mockResolvedValue({
      web: [
        {
          url: "https://a.example",
          title: "A",
          description: "About A",
          position: 1,
        },
        { url: "https://b.example" },
        {
          markdown: "# C",
          metadata: {
            sourceURL: "https://c.example",
            title: "C",
            description: "About C",
          },
        },
        { markdown: "no url" },
      ],
    });

    await expect(port.search({ query: "q", limit: 5 })).resolves.toEqual([
      { url: "https://a.example", title: "A", description: "About A" },
      { url: "https://b.example", title: undefined, description: undefined },
      { url: "https://c.example", title: "C", description: "About C" },
    ]);
  });

  it("returns nothing when the provider returns no web block", async () => {
    search.mockResolvedValue({});

    await expect(port.search({ query: "q", limit: 5 })).resolves.toEqual([]);
  });

  it("replaces a provider error with a short message carrying only the status", async () => {
    search.mockRejectedValue(
      new SdkError('{"error":"Payment required","details":"…"}', 402)
    );

    await expect(port.search({ query: "q", limit: 5 })).rejects.toThrow(
      "Web search failed (HTTP 402)."
    );
  });
});

describe("createAgentWebPort.fetchPage", () => {
  const port = createAgentWebPort();

  beforeEach(() => {
    scrape.mockReset();
  });

  it("scrapes main content as markdown and returns the resolved URL and title", async () => {
    scrape.mockResolvedValue({
      markdown: "# Hello\n\nBody.",
      metadata: { sourceURL: "https://example.com/final", title: "Hello" },
    });

    await expect(port.fetchPage("https://example.com/")).resolves.toEqual({
      url: "https://example.com/final",
      title: "Hello",
      text: "# Hello\n\nBody.",
    });
    expect(scrape).toHaveBeenCalledWith("https://example.com/", {
      formats: ["markdown"],
      onlyMainContent: true,
      timeout: 30_000,
    });
  });

  it("falls back to the requested URL and empty text when the document is bare", async () => {
    scrape.mockResolvedValue({});

    await expect(port.fetchPage("https://example.com/")).resolves.toEqual({
      url: "https://example.com/",
      title: undefined,
      text: "",
    });
  });

  it("replaces a provider error with a short message carrying only the status", async () => {
    scrape.mockRejectedValue(new SdkError("<html>blocked</html>", 403));

    await expect(port.fetchPage("https://example.com/")).rejects.toThrow(
      "Fetching the page failed (HTTP 403)."
    );
  });
});
