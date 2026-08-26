import { describe, expect, it } from "vitest";

import { InMemoryDraftStore } from "../src/draft/memory-draft-store.ts";
import { commitDraftTool } from "../src/tools/commit.tool.ts";
import { patchDraftMetaTool } from "../src/tools/draft.tool.ts";
import { fetchUrlTool, webSearchTool } from "../src/tools/retrieval.tool.ts";
import { createWritingTools } from "../src/tools/tool-set.ts";
import type { WritingToolContext } from "../src/types.ts";

import { createFakeContentPort, createFakeWebPort } from "./fixtures.ts";
import type { FakeContentPort, FakeWebPort } from "./fixtures.ts";

const SESSION_ID = "session-1";

type TestContext = WritingToolContext & {
  content: FakeContentPort;
  web: FakeWebPort;
};

const createContext = (): TestContext => ({
  agentSessionId: SESSION_ID,
  content: createFakeContentPort(),
  web: createFakeWebPort(),
  draft: new InMemoryDraftStore(),
});

describe("webSearchTool", () => {
  it("hands the turn's abort signal to the port, so a stop reaches the request", async () => {
    const context = createContext();
    const controller = new AbortController();

    await webSearchTool.execute(
      "call-1",
      { query: "embeddings guide" },
      controller.signal,
      undefined,
      context
    );
    await fetchUrlTool.execute(
      "call-2",
      { url: "https://example.com/" },
      controller.signal,
      undefined,
      context
    );

    expect(context.web.signals).toEqual([controller.signal, controller.signal]);
  });

  it("normalizes and forwards bare include domains", async () => {
    const context = createContext();

    const result = await webSearchTool.execute(
      "call-1",
      {
        query: "embeddings guide",
        includeDomains: ["Developers.OpenAI.com."],
      },
      undefined,
      undefined,
      context
    );

    expect(context.web.searches).toEqual([
      {
        query: "embeddings guide",
        limit: 5,
        includeDomains: ["developers.openai.com"],
        recency: undefined,
      },
    ]);
    expect(result.details).toMatchObject({
      count: 0,
      includeDomains: ["developers.openai.com"],
    });
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining("call `fetch_url` directly"),
    });
  });

  it("rejects URLs and paths in includeDomains", async () => {
    const context = createContext();

    await expect(
      webSearchTool.execute(
        "call-1",
        {
          query: "pgvector readme",
          includeDomains: ["https://github.com/pgvector/pgvector"],
        },
        undefined,
        undefined,
        context
      )
    ).rejects.toThrow("is not a bare hostname");
    expect(context.web.searches).toHaveLength(0);
  });
});

describe("draft slug handling", () => {
  it("normalizes an English candidate when metadata is patched", async () => {
    const context = createContext();

    const result = await patchDraftMetaTool.execute(
      "call-1",
      { slug: "Embedding RAG Architecture" },
      undefined,
      undefined,
      context
    );

    expect(result.details).toMatchObject({
      feedMeta: { slug: "embedding-rag-architecture" },
    });
  });

  it("rejects a localized title instead of producing a mixed slug", async () => {
    const context = createContext();

    await expect(
      patchDraftMetaTool.execute(
        "call-1",
        { slug: "Embedding 與 RAG 架構" },
        undefined,
        undefined,
        context
      )
    ).rejects.toThrow("must be an English/ASCII phrase");
    await expect(context.draft.get(SESSION_ID)).resolves.toMatchObject({
      feedMeta: {},
    });
  });

  it("requires an explicit slug before creating a feed", async () => {
    const context = createContext();
    await context.draft.patchFeedMeta(SESSION_ID, { defaultLocale: "en" });
    await context.draft.patchTranslation(SESSION_ID, "en", {
      title: "Embedding RAG architecture",
      content: "## Architecture",
    });

    await expect(
      commitDraftTool.execute(
        "call-1",
        { confirmation: "Create the staged post." },
        undefined,
        undefined,
        context
      )
    ).rejects.toThrow("needs an English/ASCII slug");
    expect(context.content.commits).toHaveLength(0);
  });

  it("does not expose the obsolete slugify tool", () => {
    expect(createWritingTools().map((tool) => tool.name)).not.toContain(
      "slugify"
    );
  });
});
