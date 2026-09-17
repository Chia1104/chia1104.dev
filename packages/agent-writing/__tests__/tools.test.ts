const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));

vi.mock("@chia/observability/report", () => ({ reportError }));

import { describe, expect, it, vi } from "vitest";

import { InMemoryDraftStore } from "../src/draft/memory-draft-store.ts";
import { InMemoryMemoryPort } from "../src/memory/memory-port.ts";
import {
  commitDraftSpec,
  commitDraftTool,
  commitPreflight,
} from "../src/tools/commit.tool.ts";
import {
  editDraftContentTool,
  listDraftsTool,
  newDraftSpec,
  newDraftTool,
  openDraftSpec,
  openDraftTool,
  readDraftTool,
  replaceSectionTool,
  writeDraftTool,
} from "../src/tools/draft.tool.ts";
import {
  githubListTreeTool,
  githubReadFileTool,
  githubResolveRefTool,
  normalizeRepo,
} from "../src/tools/github.tool.ts";
import { fetchUrlTool, webSearchTool } from "../src/tools/retrieval.tool.ts";
import { summarizeToolResult } from "../src/tools/summarize.ts";
import { writingToolSpecs } from "../src/tools/tool-set.ts";
import type { WritingToolContext } from "../src/types.ts";

import {
  createFakeContentPort,
  createFakeGitHubPort,
  createFakeWebPort,
} from "./fixtures.ts";
import type {
  FakeContentPort,
  FakeGitHubPort,
  FakeWebPort,
} from "./fixtures.ts";

const SESSION_ID = "session-1";

type TestContext = WritingToolContext & {
  approvedDraftHashes: Map<string, string>;
  content: FakeContentPort;
  web: FakeWebPort;
  connectors: { github: FakeGitHubPort };
  draft: InMemoryDraftStore;
  memory: InMemoryMemoryPort;
};

/** Every draft tool addresses the store's first draft. */
const DRAFT_ID = 1;

const createContext = (): TestContext => ({
  agentSessionId: SESSION_ID,
  content: createFakeContentPort(),
  web: createFakeWebPort(),
  connectors: { github: createFakeGitHubPort() },
  draft: new InMemoryDraftStore([{ id: DRAFT_ID }]),
  memory: new InMemoryMemoryPort(SESSION_ID),
  approvedDraftHashes: new Map<string, string>(),
});

describe("webSearchTool", () => {
  it("hands the turn's abort signal to the port, so a stop reaches the request", async () => {
    const context = createContext();
    const controller = new AbortController();

    await webSearchTool(context).execute(
      "call-1",
      { query: "embeddings guide" },
      controller.signal
    );
    await fetchUrlTool(context).execute(
      "call-2",
      { url: "https://example.com/" },
      controller.signal
    );

    expect(context.web.signals).toEqual([controller.signal, controller.signal]);
  });

  it("normalizes and forwards bare include domains", async () => {
    const context = createContext();

    const result = await webSearchTool(context).execute("call-1", {
      query: "embeddings guide",
      includeDomains: ["Developers.OpenAI.com."],
    });

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
      webSearchTool(context).execute("call-1", {
        query: "pgvector readme",
        includeDomains: ["https://github.com/pgvector/pgvector"],
      })
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

    await fetchUrlTool(context).execute("call-1", {
      url: "https://example.com/docs",
    });

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

    await fetchUrlTool(context).execute("c1", { url: "https://example.com/a" });
    await fetchUrlTool(context).execute("c2", {
      url: "https://example.com/empty",
    });

    expect(context.memory.all.map((row) => row.title)).toEqual(["example.com"]);
  });

  it("closes a code fence the cut left open without exceeding the bound, and leaves a closed one alone", async () => {
    const context = createContext();
    const open = `intro\n\n\`\`\`ts\n${"x".repeat(260_000)}`;
    const closed = `\`\`\`ts\ncode\n\`\`\`\n\n${"y".repeat(260_000)}`;
    context.web = createFakeWebPort({
      pages: {
        "https://example.com/open": {
          url: "https://example.com/open",
          text: open,
        },
        "https://example.com/closed": {
          url: "https://example.com/closed",
          text: closed,
        },
      },
    });

    await fetchUrlTool(context).execute("c1", {
      url: "https://example.com/open",
    });
    await fetchUrlTool(context).execute("c2", {
      url: "https://example.com/closed",
    });

    const [first, second] = context.memory.all;
    expect(first?.content.endsWith("\n```")).toBe(true);
    // the memory service rejects anything past the bound, fence included
    expect(first?.content).toHaveLength(256_000);
    expect(second?.content).toHaveLength(256_000);
    expect(second?.content.endsWith("yyy")).toBe(true);
  });

  it("names the memory and the sections past the cut when a page is truncated", async () => {
    const context = createContext();
    const section = (title: string) => `## ${title}\n\n${"word ".repeat(1500)}`;
    context.web = createFakeWebPort({
      pages: {
        "https://example.com/long": {
          url: "https://example.com/long",
          text: ["Intro", "Setup", "Caveats", "Reference"]
            .map(section)
            .join("\n\n"),
        },
        "https://example.com/short": {
          url: "https://example.com/short",
          text: section("Intro"),
        },
      },
    });

    const long = await fetchUrlTool(context).execute("c1", {
      url: "https://example.com/long",
    });
    const short = await fetchUrlTool(context).execute("c2", {
      url: "https://example.com/short",
    });

    // the cut falls inside "Caveats": its tail and everything after it are unread
    expect(long.details).toMatchObject({
      truncated: true,
      memoryId: context.memory.all[0]?.id,
      unreadHeadings: ["Caveats", "Reference"],
    });
    expect(long.content[0]).toMatchObject({
      text: expect.stringContaining(
        `saved as memory #${context.memory.all[0]?.id}`
      ),
    });
    expect(short.details).toMatchObject({
      truncated: false,
      unreadHeadings: [],
    });
    expect(short.content[0]).toMatchObject({
      text: expect.not.stringContaining("saved as memory"),
    });
  });

  it("never lets the trail fail the fetch", async () => {
    const context = createContext();
    context.web = createFakeWebPort({
      pages: {
        "https://example.com/": { url: "https://example.com/", text: "body" },
      },
    });
    context.memory.save = () => Promise.reject(new Error("memory is down"));
    reportError.mockClear();

    const result = await fetchUrlTool(context).execute("call-1", {
      url: "https://example.com/",
    });

    expect(result.details).toMatchObject({ url: "https://example.com/" });
    expect(reportError).toHaveBeenCalledOnce();
  });
});

describe("draft slug handling", () => {
  it("normalizes an English candidate when metadata is patched", async () => {
    const context = createContext();

    const result = await writeDraftTool(context).execute("call-1", {
      draftId: DRAFT_ID,
      slug: "Embedding RAG Architecture",
    });

    expect(result.details).toMatchObject({
      feedMeta: { slug: "embedding-rag-architecture" },
    });
  });

  it("rejects a localized title instead of producing a mixed slug", async () => {
    const context = createContext();

    await expect(
      writeDraftTool(context).execute("call-1", {
        draftId: DRAFT_ID,
        slug: "Embedding 與 RAG 架構",
      })
    ).rejects.toThrow("must be an English/ASCII phrase");
    await expect(context.draft.get(DRAFT_ID)).resolves.toMatchObject({
      slug: null,
    });
  });

  it("writes both locales, their metadata and the slug as one revision", async () => {
    const context = createContext();
    const before = (await context.draft.get(DRAFT_ID)).revision;

    const result = await writeDraftTool(context).execute("call-1", {
      draftId: DRAFT_ID,
      slug: "Two Locales",
      defaultLocale: "zh-TW",
      translations: {
        "zh-TW": { title: "標題", content: "## 內文", description: "描述" },
        en: { title: "Title", content: "## Body" },
      },
    });

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

  it("applies the content it read when no approval pinned one, and the pinned one otherwise", async () => {
    const context = createContext();
    await context.draft.patchFeedMeta(DRAFT_ID, {
      defaultLocale: "en",
      slug: "a-post",
    });
    await context.draft.patchTranslation(DRAFT_ID, "en", {
      title: "A post",
      content: "## Body",
    });
    const current = (await context.draft.get(DRAFT_ID)).contentHash;

    await commitDraftTool(context).execute("call-auto", {
      draftId: DRAFT_ID,
      confirmation: "Commit.",
    });
    context.approvedDraftHashes.set("call-approved", "approved-earlier");
    await commitDraftTool(context).execute("call-approved", {
      draftId: DRAFT_ID,
      confirmation: "Commit.",
    });

    expect(context.content.commits).toEqual([
      { draftId: DRAFT_ID, expectedHash: current, message: "Commit." },
      {
        draftId: DRAFT_ID,
        expectedHash: "approved-earlier",
        message: "Commit.",
      },
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
      toolName: commitDraftSpec.name,
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
        toolName: commitDraftSpec.name,
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
      writeDraftTool(context).execute("call-1", {
        draftId: DRAFT_ID,
        translations: { en: {} },
      })
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
      commitDraftTool(context).execute("call-1", {
        draftId: DRAFT_ID,
        confirmation: "Create the staged post.",
      })
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

    const result = await editDraftContentTool(context).execute("call-1", {
      draftId: DRAFT_ID,
      locale: "en",
      edits: [{ oldString: "First paragraph.", newString: "Rewritten." }],
    });

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

    const result = await editDraftContentTool(context).execute("call-1", {
      draftId: DRAFT_ID,
      locale: "en",
      edits: [
        { oldString: "gamma", newString: "GAMMA" },
        { oldString: "alpha", newString: "a" },
      ],
    });
    const after = await context.draft.get(DRAFT_ID);
    expect(after.translations.en?.content).toBe("a\nbeta\nGAMMA");
    expect(after.revision).toBe(before + 1);
    expect(result.details).toMatchObject({
      replacements: 2,
      edits: [{ line: 3 }, { line: 1 }],
    });

    await expect(
      editDraftContentTool(context).execute("call-2", {
        draftId: DRAFT_ID,
        locale: "en",
        edits: [
          { oldString: "beta", newString: "b" },
          { oldString: "missing", newString: "x" },
        ],
      })
    ).rejects.toThrow(/Edit 2 of 2 was not applied/);
    expect((await context.draft.get(DRAFT_ID)).translations.en?.content).toBe(
      "a\nbeta\nGAMMA"
    );
  });

  it("lands a target that differs only in whitespace or quote style, and says so", async () => {
    const context = createContext();
    await context.draft.patchTranslation(DRAFT_ID, "en", {
      content: "## Title\n\nShe said \u201Chello\u201D \u2014 twice.  \n\nEnd.",
    });

    const result = await editDraftContentTool(context).execute("call-1", {
      draftId: DRAFT_ID,
      locale: "en",
      edits: [
        { oldString: 'She said "hello" - twice.', newString: "Rewritten." },
      ],
    });

    expect(result.details).toMatchObject({
      edits: [{ match: "punctuation", line: 3 }],
    });
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining("matched reading curly quotes"),
    });
    expect((await context.draft.get(DRAFT_ID)).translations.en?.content).toBe(
      "## Title\n\nRewritten.  \n\nEnd."
    );
  });

  it("refuses an ambiguous target with the way forward, instead of guessing", async () => {
    const context = createContext();
    await context.draft.patchTranslation(DRAFT_ID, "en", {
      content: "same line\nsame line",
    });

    await expect(
      editDraftContentTool(context).execute("call-1", {
        draftId: DRAFT_ID,
        locale: "en",
        edits: [{ oldString: "same line", newString: "changed" }],
      })
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
      writeDraftTool(context).execute("call-1", {
        draftId: DRAFT_ID,
        translations: { en: { content: "## Model version" } },
      })
    ).rejects.toThrow("Someone else changed en.content");
    expect((await context.draft.get(DRAFT_ID)).translations.en?.content).toBe(
      "## Operator version"
    );
  });

  it("names a discarded draft instead of writing into the void", async () => {
    const context = createContext();
    context.draft.discard(DRAFT_ID);

    await expect(
      writeDraftTool(context).execute("call-1", {
        draftId: DRAFT_ID,
        translations: { en: { content: "## Body" } },
      })
    ).rejects.toThrow("does not exist or was discarded");
  });

  it("lists open drafts with the id the other tools take, and opens a post's draft once", async () => {
    const context = createContext();
    await context.draft.patchTranslation(DRAFT_ID, "en", { title: "First" });

    const listed = await listDraftsTool(context).execute("call-1", {});
    expect(listed.details).toMatchObject({
      drafts: [{ id: DRAFT_ID, title: "First", locales: ["en"] }],
    });

    const opened = await openDraftTool(context).execute("call-2", {
      feedId: 42,
    });
    const again = await openDraftTool(context).execute("call-3", {
      feedId: 42,
    });
    expect(opened.details).toMatchObject({ feedId: 42 });
    expect(again.details).toEqual(opened.details);
    expect(await context.draft.list()).toHaveLength(2);

    // A new post has no id, so its tool takes none.
    const fresh = await newDraftTool(context).execute("call-4", {});
    expect(fresh.details).toMatchObject({ feedId: null });
    expect(fresh.details).not.toMatchObject({ draftId: DRAFT_ID });
    expect(await context.draft.list()).toHaveLength(3);
    expect(summarizeToolResult(newDraftSpec.name, fresh, false)).toMatch(
      /^Opened draft #\d+ for a new post\.$/
    );
    expect(summarizeToolResult(openDraftSpec.name, opened, false)).toMatch(
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
      writeDraftTool(context).execute("call-1", {
        draftId: DRAFT_ID,
        translations: { en: { title: "Title", content: chinese } },
      })
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
    const edited = await editDraftContentTool(context).execute("call-2", {
      draftId: DRAFT_ID,
      locale: "en",
      edits: [{ oldString: "Short.", newString: chinese }],
    });
    expect(edited.details).toMatchObject({
      replacements: 1,
      warning: expect.stringContaining("English prose"),
    });
    await expect(
      commitPreflight(context)({
        toolCallId: "call-3",
        toolName: commitDraftSpec.name,
        input: { draftId: DRAFT_ID, confirmation: "Commit." },
      })
    ).resolves.toMatchObject({
      block: true,
      reason: expect.stringContaining("English prose"),
    });
  });

  it("does not expose the obsolete slugify tool", () => {
    expect(writingToolSpecs.map((tool) => tool.name)).not.toContain("slugify");
  });
});

describe("normalizeRepo", () => {
  it("accepts owner/name and github.com URLs, lower-cased and without .git", () => {
    expect(normalizeRepo("Chia1104/chia1104.dev")).toBe(
      "chia1104/chia1104.dev"
    );
    expect(
      normalizeRepo(
        "https://github.com/Chia1104/Chia1104.dev/blob/main/README.md"
      )
    ).toBe("chia1104/chia1104.dev");
    expect(normalizeRepo("github.com/owner/repo.git")).toBe("owner/repo");
  });

  it("rejects anything without an owner and a name", () => {
    expect(() => normalizeRepo("chia1104")).toThrow("is not a repository");
    expect(() => normalizeRepo("https://gitlab.com/a/b")).toThrow(
      "is not a repository"
    );
  });
});

describe("github tools", () => {
  it("resolves the ref through the port with the normalized repo and the turn's signal", async () => {
    const context = createContext();
    const controller = new AbortController();

    const result = await githubResolveRefTool(context).execute(
      "call-1",
      { repo: "https://github.com/Owner/Repo", ref: " v1.2.0 " },
      controller.signal
    );

    expect(context.connectors.github.calls).toEqual([
      { method: "resolveRef", input: { repo: "owner/repo", ref: "v1.2.0" } },
    ]);
    expect(context.connectors.github.signals).toEqual([controller.signal]);
    expect(result.details).toMatchObject({ repo: "owner/repo", ref: "v1.2.0" });
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining("Cite files as `path@0123456`"),
    });
  });

  it("lists a directory with trailing slashes on subdirectories and sizes on files", async () => {
    const context = createContext();
    context.connectors.github = createFakeGitHubPort({
      trees: {
        "owner/repo/src": [
          { path: "src/tools", type: "dir" },
          { path: "src/index.ts", type: "file", size: 120 },
        ],
      },
    });

    const result = await githubListTreeTool(context).execute("call-1", {
      repo: "owner/repo",
      path: "/src/",
    });

    expect(context.connectors.github.calls[0]).toEqual({
      method: "listTree",
      input: {
        repo: "owner/repo",
        ref: undefined,
        path: "src",
        recursive: false,
      },
    });
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining("src/tools/\nsrc/index.ts (120 B)"),
    });
    expect(result.details).toMatchObject({
      path: "src",
      count: 2,
      truncated: false,
    });
  });

  it("reads a line range and reports the permalink at the resolved sha", async () => {
    const context = createContext();
    context.connectors.github = createFakeGitHubPort({
      files: { "owner/repo/src/index.ts": "one\ntwo\nthree\nfour" },
    });

    const result = await githubReadFileTool(context).execute("call-1", {
      repo: "owner/repo",
      path: "./src/index.ts",
      startLine: 2,
      endLine: 3,
    });

    expect(result.content[0]).toMatchObject({
      text:
        "# owner/repo/src/index.ts @ 0123456 (lines 2–3 of 4)\n" +
        "<https://github.com/owner/repo/blob/0123456789abcdef0123456789abcdef01234567/src/index.ts>\n\n" +
        "two\nthree",
    });
    expect(result.details).toMatchObject({
      startLine: 2,
      endLine: 3,
      lineCount: 4,
      truncated: false,
    });
  });

  it("refuses a line range outside the file and a path that is the root", async () => {
    const context = createContext();
    context.connectors.github = createFakeGitHubPort({
      files: { "owner/repo/a.txt": "only" },
    });

    await expect(
      githubReadFileTool(context).execute("call-1", {
        repo: "owner/repo",
        path: "a.txt",
        startLine: 3,
      })
    ).rejects.toThrow("outside the file");
    await expect(
      githubReadFileTool(context).execute("call-2", {
        repo: "owner/repo",
        path: "/",
      })
    ).rejects.toThrow("must name a file");
  });

  it("lists every github tool as read tier with a stable transcript line", () => {
    const names = writingToolSpecs.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "github_resolve_ref",
        "github_list_tree",
        "github_read_file",
      ])
    );
    expect(
      summarizeToolResult(
        "github_read_file",
        {
          content: [{ type: "text", text: "" }],
          details: {
            repo: "owner/repo",
            path: "src/index.ts",
            sha: "0123456789",
          },
        },
        false
      )
    ).toBe("Read owner/repo/src/index.ts@0123456.");
  });
});

const SECTIONED = [
  "Intro paragraph.",
  "",
  "## Setup",
  "",
  "Install it.",
  "",
  "### Install",
  "",
  "Run the command.",
  "",
  "## Caveats",
  "",
  "None yet.",
].join("\n");

describe("readDraftTool", () => {
  it("prefixes a body read with its outline and reads one section or a line range", async () => {
    const context = createContext();
    await context.draft.patchTranslation(DRAFT_ID, "en", {
      title: "T",
      content: SECTIONED,
    });

    const whole = await readDraftTool(context).execute("call-1", {
      draftId: DRAFT_ID,
      locale: "en",
    });
    expect(whole.content[0]).toMatchObject({
      text: expect.stringContaining(
        "line 3 (h2): Setup\nline 7 (h3): Setup > Install\nline 11 (h2): Caveats"
      ),
    });
    expect(whole.details).toMatchObject({
      lineCount: 13,
      outline: [
        { line: 3, level: 2, path: "Setup" },
        { line: 7, level: 3, path: "Setup > Install" },
        { line: 11, level: 2, path: "Caveats" },
      ],
    });

    const section = await readDraftTool(context).execute("call-2", {
      draftId: DRAFT_ID,
      locale: "en",
      heading: "Setup > Install",
    });
    expect(section.content[0]).toMatchObject({
      text: expect.stringContaining("7\t### Install\n8\t\n9\tRun the command."),
    });
    expect(section.details).toMatchObject({
      heading: "Setup > Install",
      lineCount: 3,
    });

    const range = await readDraftTool(context).execute("call-3", {
      draftId: DRAFT_ID,
      locale: "en",
      fromLine: 11,
      toLine: 40,
    });
    expect(range.content[0]).toMatchObject({
      text: expect.stringContaining("11\t## Caveats\n12\t\n13\tNone yet."),
    });
    expect(range.details).toMatchObject({ lines: { from: 11, to: 13 } });
  });

  it("narrows a section to the lines given with it", async () => {
    const context = createContext();
    await context.draft.patchTranslation(DRAFT_ID, "en", {
      content: SECTIONED,
    });

    const both = await readDraftTool(context).execute("call-1", {
      draftId: DRAFT_ID,
      locale: "en",
      heading: "Setup",
      fromLine: 1,
      toLine: 5,
    });
    expect(both.content[0]).toMatchObject({
      text: expect.stringContaining('Section "Setup", lines 3-5 of 13'),
    });
    expect(both.details).toMatchObject({
      heading: "Setup",
      lines: { from: 3, to: 5 },
    });

    await expect(
      readDraftTool(context).execute("call-2", {
        draftId: DRAFT_ID,
        locale: "en",
        heading: "Caveats",
        toLine: 5,
      })
    ).rejects.toThrow(/outside section "Caveats"/);
    await expect(
      readDraftTool(context).execute("call-3", {
        draftId: DRAFT_ID,
        locale: "en",
        fromLine: 20,
      })
    ).rejects.toThrow(/outside the body \(13 lines\)/);
  });

  it("refuses an unknown heading with the outline", async () => {
    const context = createContext();
    await context.draft.patchTranslation(DRAFT_ID, "en", {
      content: SECTIONED,
    });
    await expect(
      readDraftTool(context).execute("call-1", {
        draftId: DRAFT_ID,
        locale: "en",
        heading: "Install",
      })
    ).rejects.toThrow(/No section at heading "Install".*Setup > Install/s);
  });
});

describe("replaceSectionTool", () => {
  it("replaces a heading's section with its subsections as one exact edit", async () => {
    const context = createContext();
    await context.draft.patchTranslation(DRAFT_ID, "en", {
      content: SECTIONED,
    });
    const before = (await context.draft.get(DRAFT_ID)).revision;

    const result = await replaceSectionTool(context).execute("call-1", {
      draftId: DRAFT_ID,
      locale: "en",
      heading: "Setup",
      content: "## Getting started\n\nOne step.",
    });

    const after = await context.draft.get(DRAFT_ID);
    expect(after.translations.en?.content).toBe(
      "Intro paragraph.\n\n## Getting started\n\nOne step.\n\n## Caveats\n\nNone yet."
    );
    expect(after.revision).toBe(before + 1);
    expect(result.details).toMatchObject({
      heading: "Setup",
      deleted: false,
      edits: [{ match: "exact", line: 3, replacements: 1 }],
    });
    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining('Replaced section "Setup" (was lines 3-9)'),
    });
  });

  it("deletes a section together with the blank lines before it", async () => {
    const context = createContext();
    await context.draft.patchTranslation(DRAFT_ID, "en", {
      content: SECTIONED,
    });

    const result = await replaceSectionTool(context).execute("call-1", {
      draftId: DRAFT_ID,
      locale: "en",
      heading: "Caveats",
      content: "",
    });

    expect(result.content[0]).toMatchObject({
      text: expect.stringContaining(
        'Deleted section "Caveats" (was lines 11-13)'
      ),
    });
    expect((await context.draft.get(DRAFT_ID)).translations.en?.content).toBe(
      "Intro paragraph.\n\n## Setup\n\nInstall it.\n\n### Install\n\nRun the command."
    );
  });

  it("refuses content that drops the heading line, and an operator edit made since the read", async () => {
    const context = createContext();
    await context.draft.patchTranslation(DRAFT_ID, "en", {
      content: SECTIONED,
    });

    await expect(
      replaceSectionTool(context).execute("call-1", {
        draftId: DRAFT_ID,
        locale: "en",
        heading: "Caveats",
        content: "Prose only.",
      })
    ).rejects.toThrow(/must start with the section's heading line/);

    const original = context.draft.get.bind(context.draft);
    vi.spyOn(context.draft, "get").mockImplementationOnce(async (id) => {
      const draft = await original(id);
      context.draft.operatorEdit(DRAFT_ID, "en", {
        content: SECTIONED.replace("None yet.", "Some now."),
      });
      return draft;
    });
    await expect(
      replaceSectionTool(context).execute("call-2", {
        draftId: DRAFT_ID,
        locale: "en",
        heading: "Caveats",
        content: "## Caveats\n\nNew.",
      })
    ).rejects.toThrow(/was not applied/);
    expect(
      (await context.draft.get(DRAFT_ID)).translations.en?.content
    ).toContain("Some now.");
  });
});
