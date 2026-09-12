import { describe, expect, it, vi } from "vitest";

import { InMemoryDraftStore } from "../src/draft/memory-draft-store.ts";
import { InMemoryMemoryPort } from "../src/memory/memory-port.ts";
import { commitDraftTool, commitPreflight } from "../src/tools/commit.tool.ts";
import {
  editDraftContentTool,
  listDraftsTool,
  newDraftTool,
  openDraftTool,
  writeDraftTool,
} from "../src/tools/draft.tool.ts";
import { fetchUrlTool, webSearchTool } from "../src/tools/retrieval.tool.ts";
import { summarizeToolResult } from "../src/tools/summarize.ts";
import { createWritingTools } from "../src/tools/tool-set.ts";
import type { WritingToolContext } from "../src/types.ts";

import { createFakeContentPort, createFakeWebPort } from "./fixtures.ts";
import type { FakeContentPort, FakeWebPort } from "./fixtures.ts";

const SESSION_ID = "session-1";

type TestContext = WritingToolContext & {
  approvedDraftRevisions: Map<string, number>;
  content: FakeContentPort;
  web: FakeWebPort;
  draft: InMemoryDraftStore;
  memory: InMemoryMemoryPort;
};

/** Every draft tool addresses the store's first draft. */
const DRAFT_ID = 1;

const createContext = (): TestContext => ({
  agentSessionId: SESSION_ID,
  content: createFakeContentPort(),
  web: createFakeWebPort(),
  draft: new InMemoryDraftStore([{ id: DRAFT_ID }]),
  memory: new InMemoryMemoryPort(SESSION_ID),
  approvedDraftRevisions: new Map<string, number>(),
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

describe("fetchUrlTool source trail", () => {
  it("records the fetched page as a source memory keyed on its URL", async () => {
    const context = createContext();
    context.web = createFakeWebPort({
      pages: {
        "https://example.com/docs": {
          url: "https://example.com/docs#intro",
          title: "  Example docs  ",
          text: `${"body ".repeat(200)}tail`,
        },
      },
    });

    await fetchUrlTool.execute(
      "call-1",
      { url: "https://example.com/docs" },
      undefined,
      undefined,
      context
    );

    const [source] = context.memory.all;
    expect(source).toMatchObject({
      kind: "source",
      title: "Example docs",
      sourceUrl: "https://example.com/docs#intro",
    });
    // the whole page as the model saw it, not an excerpt
    expect(source?.content).toHaveLength("body ".repeat(200).length + 4);
    expect(source?.content?.endsWith("tail")).toBe(true);
  });

  it("falls back to the hostname for an untitled page and skips an empty one", async () => {
    const context = createContext();
    context.web = createFakeWebPort({
      pages: {
        "https://example.com/a": {
          url: "https://example.com/a",
          text: "some text",
        },
        "https://example.com/empty": {
          url: "https://example.com/empty",
          text: "  ",
        },
      },
    });

    await fetchUrlTool.execute(
      "c1",
      { url: "https://example.com/a" },
      undefined,
      undefined,
      context
    );
    await fetchUrlTool.execute(
      "c2",
      { url: "https://example.com/empty" },
      undefined,
      undefined,
      context
    );

    expect(context.memory.all.map((row) => row.title)).toEqual(["example.com"]);
  });

  it("never lets the trail fail the fetch", async () => {
    const context = createContext();
    context.web = createFakeWebPort({
      pages: {
        "https://example.com/": { url: "https://example.com/", text: "body" },
      },
    });
    context.memory.save = () => Promise.reject(new Error("memory is down"));
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await fetchUrlTool.execute(
      "call-1",
      { url: "https://example.com/" },
      undefined,
      undefined,
      context
    );

    expect(result.details).toMatchObject({ url: "https://example.com/" });
    expect(errors).toHaveBeenCalledOnce();
    errors.mockRestore();
  });
});

describe("draft slug handling", () => {
  it("normalizes an English candidate when metadata is patched", async () => {
    const context = createContext();

    const result = await writeDraftTool.execute(
      "call-1",
      { draftId: DRAFT_ID, slug: "Embedding RAG Architecture" },
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
      writeDraftTool.execute(
        "call-1",
        { draftId: DRAFT_ID, slug: "Embedding 與 RAG 架構" },
        undefined,
        undefined,
        context
      )
    ).rejects.toThrow("must be an English/ASCII phrase");
    await expect(context.draft.get(DRAFT_ID)).resolves.toMatchObject({
      slug: null,
    });
  });

  it("writes both locales, their metadata and the slug as one revision", async () => {
    const context = createContext();
    const before = (await context.draft.get(DRAFT_ID)).revision;

    const result = await writeDraftTool.execute(
      "call-1",
      {
        draftId: DRAFT_ID,
        slug: "Two Locales",
        defaultLocale: "zh-TW",
        translations: {
          "zh-TW": { title: "標題", content: "## 內文", description: "描述" },
          en: { title: "Title", content: "## Body" },
        },
      },
      undefined,
      undefined,
      context
    );

    const draft = await context.draft.get(DRAFT_ID);
    expect(draft.revision).toBe(before + 1);
    expect(draft).toMatchObject({
      slug: "two-locales",
      defaultLocale: "zh-TW",
      translations: {
        "zh-TW": { title: "標題", content: "## 內文", description: "描述" },
        en: { title: "Title", content: "## Body" },
      },
    });
    expect(result.details).toMatchObject({
      feedMeta: { slug: "two-locales" },
      translations: {
        "zh-TW": { title: "標題", lineCount: 1 },
        en: { title: "Title", lineCount: 1 },
      },
      warnings: [],
    });
  });

  it("applies the revision it read when no approval pinned one, and the pinned one otherwise", async () => {
    const context = createContext();
    await context.draft.patchFeedMeta(DRAFT_ID, {
      defaultLocale: "en",
      slug: "a-post",
    });
    await context.draft.patchTranslation(DRAFT_ID, "en", {
      title: "A post",
      content: "## Body",
    });
    const current = (await context.draft.get(DRAFT_ID)).revision;

    await commitDraftTool.execute(
      "call-auto",
      { draftId: DRAFT_ID, confirmation: "Commit." },
      undefined,
      undefined,
      context
    );
    context.approvedDraftRevisions.set("call-approved", current - 1);
    await commitDraftTool.execute(
      "call-approved",
      { draftId: DRAFT_ID, confirmation: "Commit." },
      undefined,
      undefined,
      context
    );

    expect(context.content.commits).toEqual([
      { draftId: DRAFT_ID, expectedRevision: current },
      { draftId: DRAFT_ID, expectedRevision: current - 1 },
    ]);
  });

  it("refuses a commit before approval while metadata is empty, unless the model owns it", async () => {
    const context = createContext();
    await context.draft.write(DRAFT_ID, {
      meta: { defaultLocale: "en", slug: "a-post" },
      translations: {
        en: { title: "A post", content: "## Body", summary: "S" },
      },
    });
    const preflight = commitPreflight(context);
    const request = (input: {
      draftId: number;
      confirmation: string;
      allowEmptyMetadata?: boolean;
    }) => ({
      toolCallId: "call-1",
      toolName: commitDraftTool.name,
      input,
    });

    await expect(
      preflight(request({ draftId: DRAFT_ID, confirmation: "Commit." }))
    ).resolves.toMatchObject({
      block: true,
      reason: expect.stringMatching(/en: excerpt, description/),
    });
    await expect(
      preflight(
        request({
          draftId: DRAFT_ID,
          confirmation: "Commit without excerpt and description.",
          allowEmptyMetadata: true,
        })
      )
    ).resolves.toBeUndefined();

    await context.draft.write(DRAFT_ID, {
      translations: { en: { excerpt: "E", description: "D" } },
    });
    await expect(
      preflight(request({ draftId: DRAFT_ID, confirmation: "Commit." }))
    ).resolves.toBeUndefined();
    // Another tool is none of the preflight's business.
    await expect(
      preflight({ toolCallId: "c", toolName: "read_draft", input: {} })
    ).resolves.toBeUndefined();
  });

  it("refuses a slugless new post before approval, with the same message execute gives", async () => {
    const context = createContext();
    await context.draft.write(DRAFT_ID, {
      meta: { defaultLocale: "en" },
      translations: { en: { title: "T", content: "## B" } },
    });
    await expect(
      commitPreflight(context)({
        toolCallId: "call-1",
        toolName: commitDraftTool.name,
        input: {
          draftId: DRAFT_ID,
          confirmation: "Create.",
          allowEmptyMetadata: true,
        },
      })
    ).resolves.toMatchObject({
      block: true,
      reason: expect.stringMatching(/needs an English\/ASCII slug/),
    });
  });

  it("treats an empty per-locale object as nothing to write", async () => {
    const context = createContext();
    const before = (await context.draft.get(DRAFT_ID)).revision;

    await expect(
      writeDraftTool.execute(
        "call-1",
        { draftId: DRAFT_ID, translations: { en: {} } },
        undefined,
        undefined,
        context
      )
    ).rejects.toThrow("Nothing to write");
    const after = await context.draft.get(DRAFT_ID);
    expect(after.revision).toBe(before);
    expect(after.translations.en).toBeUndefined();
  });

  it("requires an explicit slug before creating a feed", async () => {
    const context = createContext();
    await context.draft.patchFeedMeta(DRAFT_ID, { defaultLocale: "en" });
    await context.draft.patchTranslation(DRAFT_ID, "en", {
      title: "Embedding RAG architecture",
      content: "## Architecture",
    });

    await expect(
      commitDraftTool.execute(
        "call-1",
        { draftId: DRAFT_ID, confirmation: "Create the staged post." },
        undefined,
        undefined,
        context
      )
    ).rejects.toThrow("needs an English/ASCII slug");
    expect(context.content.commits).toHaveLength(0);
  });

  it("lands an exact edit on the body the operator saved in between", async () => {
    const context = createContext();
    await context.draft.patchTranslation(DRAFT_ID, "en", {
      content: "## Title\n\nFirst paragraph.\n\nSecond paragraph.",
    });
    context.draft.operatorEdit(DRAFT_ID, "en", {
      content:
        "## Title\n\nFirst paragraph.\n\nSecond paragraph.\n\nOperator note.",
    });

    const result = await editDraftContentTool.execute(
      "call-1",
      {
        draftId: DRAFT_ID,
        locale: "en",
        edits: [{ oldString: "First paragraph.", newString: "Rewritten." }],
      },
      undefined,
      undefined,
      context
    );

    expect(result.details).toMatchObject({
      replacements: 1,
      edits: [{ line: 3, replacements: 1 }],
    });
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining("3\tRewritten."),
    });
    expect((await context.draft.get(DRAFT_ID)).translations.en?.content).toBe(
      "## Title\n\nRewritten.\n\nSecond paragraph.\n\nOperator note."
    );
  });

  it("applies a batch in order as one revision and refuses the whole batch on one miss", async () => {
    const context = createContext();
    await context.draft.patchTranslation(DRAFT_ID, "en", {
      content: "alpha\nbeta\ngamma",
    });
    const before = (await context.draft.get(DRAFT_ID)).revision;

    const result = await editDraftContentTool.execute(
      "call-1",
      {
        draftId: DRAFT_ID,
        locale: "en",
        edits: [
          { oldString: "gamma", newString: "GAMMA" },
          { oldString: "alpha", newString: "a" },
        ],
      },
      undefined,
      undefined,
      context
    );
    const after = await context.draft.get(DRAFT_ID);
    expect(after.translations.en?.content).toBe("a\nbeta\nGAMMA");
    expect(after.revision).toBe(before + 1);
    expect(result.details).toMatchObject({
      replacements: 2,
      edits: [{ line: 3 }, { line: 1 }],
    });

    await expect(
      editDraftContentTool.execute(
        "call-2",
        {
          draftId: DRAFT_ID,
          locale: "en",
          edits: [
            { oldString: "beta", newString: "b" },
            { oldString: "missing", newString: "x" },
          ],
        },
        undefined,
        undefined,
        context
      )
    ).rejects.toThrow(/Edit 2 of 2 was not applied/);
    expect((await context.draft.get(DRAFT_ID)).translations.en?.content).toBe(
      "a\nbeta\nGAMMA"
    );
  });

  it("refuses an ambiguous target with the way forward, instead of guessing", async () => {
    const context = createContext();
    await context.draft.patchTranslation(DRAFT_ID, "en", {
      content: "same line\nsame line",
    });

    await expect(
      editDraftContentTool.execute(
        "call-1",
        {
          draftId: DRAFT_ID,
          locale: "en",
          edits: [{ oldString: "same line", newString: "changed" }],
        },
        undefined,
        undefined,
        context
      )
    ).rejects.toThrow(/matches 2 places/);
    expect((await context.draft.get(DRAFT_ID)).translations.en?.content).toBe(
      "same line\nsame line"
    );
  });

  it("refuses a whole-body write over an operator edit the model has not read", async () => {
    const context = createContext();
    await context.draft.patchTranslation(DRAFT_ID, "en", { content: "## Old" });
    context.draft.operatorEdit(DRAFT_ID, "en", {
      content: "## Operator version",
    });

    await expect(
      writeDraftTool.execute(
        "call-1",
        {
          draftId: DRAFT_ID,
          translations: { en: { content: "## Model version" } },
        },
        undefined,
        undefined,
        context
      )
    ).rejects.toThrow("someone else changed it");
    expect((await context.draft.get(DRAFT_ID)).translations.en?.content).toBe(
      "## Operator version"
    );
  });

  it("names a discarded draft instead of writing into the void", async () => {
    const context = createContext();
    context.draft.discard(DRAFT_ID);

    await expect(
      writeDraftTool.execute(
        "call-1",
        { draftId: DRAFT_ID, translations: { en: { content: "## Body" } } },
        undefined,
        undefined,
        context
      )
    ).rejects.toThrow("does not exist or was discarded");
  });

  it("lists open drafts with the id the other tools take, and opens a post's draft once", async () => {
    const context = createContext();
    await context.draft.patchTranslation(DRAFT_ID, "en", { title: "First" });

    const listed = await listDraftsTool.execute(
      "call-1",
      {},
      undefined,
      undefined,
      context
    );
    expect(listed.details).toMatchObject({
      drafts: [{ id: DRAFT_ID, title: "First", locales: ["en"] }],
    });

    const opened = await openDraftTool.execute(
      "call-2",
      { feedId: 42 },
      undefined,
      undefined,
      context
    );
    const again = await openDraftTool.execute(
      "call-3",
      { feedId: 42 },
      undefined,
      undefined,
      context
    );
    expect(opened.details).toMatchObject({ feedId: 42 });
    expect(again.details).toEqual(opened.details);
    expect(await context.draft.list()).toHaveLength(2);

    // A new post has no id, so its tool takes none.
    const fresh = await newDraftTool.execute(
      "call-4",
      {},
      undefined,
      undefined,
      context
    );
    expect(fresh.details).toMatchObject({ feedId: null });
    expect(fresh.details).not.toMatchObject({ draftId: DRAFT_ID });
    expect(await context.draft.list()).toHaveLength(3);
    expect(summarizeToolResult(newDraftTool.name, fresh, false)).toMatch(
      /^Opened draft #\d+ for a new post\.$/
    );
    expect(summarizeToolResult(openDraftTool.name, opened, false)).toMatch(
      /^Opened draft #\d+ for feed 42\.$/
    );
  });

  it("refuses a body in the other locale's language, warns after an edit and blocks the commit", async () => {
    const context = createContext();
    const chinese =
      "這一段說明索引是怎麼建立的，以及規劃器為什麼會選擇它而不是全表掃描。".repeat(
        4
      );

    await expect(
      writeDraftTool.execute(
        "call-1",
        {
          draftId: DRAFT_ID,
          translations: { en: { title: "Title", content: chinese } },
        },
        undefined,
        undefined,
        context
      )
    ).rejects.toThrow("en locale takes English prose");
    expect((await context.draft.get(DRAFT_ID)).translations.en).toBeUndefined();

    await context.draft.write(DRAFT_ID, {
      meta: { defaultLocale: "en", slug: "a-post" },
      translations: {
        en: {
          title: "A post",
          content: "## Body\n\nShort.",
          excerpt: "E",
          description: "D",
          summary: "S",
        },
      },
    });
    const edited = await editDraftContentTool.execute(
      "call-2",
      {
        draftId: DRAFT_ID,
        locale: "en",
        edits: [{ oldString: "Short.", newString: chinese }],
      },
      undefined,
      undefined,
      context
    );
    expect(edited.details).toMatchObject({
      replacements: 1,
      warning: expect.stringContaining("English prose"),
    });
    await expect(
      commitPreflight(context)({
        toolCallId: "call-3",
        toolName: commitDraftTool.name,
        input: { draftId: DRAFT_ID, confirmation: "Commit." },
      })
    ).resolves.toMatchObject({
      block: true,
      reason: expect.stringContaining("English prose"),
    });
  });

  it("does not expose the obsolete slugify tool", () => {
    expect(createWritingTools().map((tool) => tool.name)).not.toContain(
      "slugify"
    );
  });
});
