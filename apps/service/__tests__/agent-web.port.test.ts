const { search } = vi.hoisted(() => ({ search: vi.fn() }));

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
  }
  return { Firecrawl, SdkError };
});

import { SdkError } from "firecrawl";

import { createAgentWebPort } from "../src/services/agent-web.port";

/**
 * The port is the only place Firecrawl's request and response shapes are known. These pin the
 * mapping the tool relies on: recency → `tbs`, no `scrapeOptions` (cost), and hits reduced to
 * `{ url, title, description }` whichever shape the SDK returns.
 */

describe("createAgentWebPort.search", () => {
  const port = createAgentWebPort();

  beforeEach(() => {
    search.mockReset();
  });

  it("sends the query with limit, recency as tbs, web source only and no scrape", async () => {
    search.mockResolvedValue({ web: [] });

    await port.search({ query: "hono v5 release", limit: 3, recency: "week" });

    expect(search).toHaveBeenCalledWith("hono v5 release", {
      limit: 3,
      tbs: "qdr:w",
      sources: ["web"],
      timeout: 30_000,
    });
    expect(search.mock.calls[0]?.[1]).not.toHaveProperty("scrapeOptions");
  });

  it("omits tbs when no recency is given", async () => {
    search.mockResolvedValue({ web: [] });

    await port.search({ query: "q", limit: 5 });

    expect(search.mock.calls[0]?.[1]).toMatchObject({ tbs: undefined });
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
