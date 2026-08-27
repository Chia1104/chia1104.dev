import { describe, expect, it } from "vitest";

import { InMemoryDraftStore } from "../src/draft/memory-draft-store.ts";
import { InMemoryMemoryPort } from "../src/memory/memory-port.ts";
import {
  getMemoryTool,
  saveMemoryTool,
  searchMemoryTool,
} from "../src/tools/memory.tool.ts";
import { TOOL_NAMES, tierOf } from "../src/tools/registry.ts";
import { summarizeToolResult } from "../src/tools/summarize.ts";
import {
  createWritingTools,
  readOnlyToolNames,
} from "../src/tools/tool-set.ts";
import type { WritingToolContext } from "../src/types.ts";

import { createFakeContentPort, createFakeWebPort } from "./fixtures.ts";

const SESSION_ID = "session-1";

const createContext = (): WritingToolContext & {
  memory: InMemoryMemoryPort;
} => ({
  agentSessionId: SESSION_ID,
  content: createFakeContentPort(),
  web: createFakeWebPort(),
  draft: new InMemoryDraftStore(),
  memory: new InMemoryMemoryPort(SESSION_ID),
});

describe("memory tools", () => {
  it("saves a fact and finds it again by search, then reads it by id", async () => {
    const context = createContext();

    const saved = await saveMemoryTool.execute(
      "call-1",
      {
        title: "pgvector 0.8 adds iterative index scans",
        content: "Set `hnsw.iterative_scan = relaxed_order` on pgvector 0.8+.",
        sourceUrl: "https://github.com/pgvector/pgvector#iterative-index-scans",
      },
      undefined,
      undefined,
      context
    );
    expect(saved.details).toMatchObject({ id: 1, kind: "fact" });
    expect(summarizeToolResult(TOOL_NAMES.saveMemory, saved, false)).toBe(
      "Saved memory #1."
    );

    const found = await searchMemoryTool.execute(
      "call-2",
      { query: "iterative_scan" },
      undefined,
      undefined,
      context
    );
    expect(found.details).toMatchObject({
      query: "iterative_scan",
      hits: [
        { id: 1, kind: "fact", title: expect.stringContaining("pgvector") },
      ],
    });
    expect(found.content[0]).toMatchObject({
      text: expect.stringContaining("(#1)"),
    });
    expect(summarizeToolResult(TOOL_NAMES.searchMemory, found, false)).toBe(
      'Searched memory for "iterative_scan" (1 hits).'
    );

    const read = await getMemoryTool.execute(
      "call-3",
      { id: 1 },
      undefined,
      undefined,
      context
    );
    expect(read.content[0]).toMatchObject({
      text: expect.stringContaining("relaxed_order"),
    });
    expect(read.details).toMatchObject({
      id: 1,
      status: "active",
      detail: "full",
    });
  });

  it("tells the model to research when nothing matches, and rejects an unknown id", async () => {
    const context = createContext();

    const found = await searchMemoryTool.execute(
      "call-1",
      { query: "nothing" },
      undefined,
      undefined,
      context
    );
    expect(found.details).toEqual({ query: "nothing", hits: [] });
    expect(found.content[0]).toMatchObject({
      text: expect.stringContaining("web_search"),
    });

    await expect(
      getMemoryTool.execute("call-2", { id: 42 }, undefined, undefined, context)
    ).rejects.toThrow("No memory #42");
  });

  it("only ever writes facts; sources and lessons have other authors", async () => {
    const context = createContext();
    await saveMemoryTool.execute(
      "call-1",
      { title: "A decision", content: "Use tabs." },
      undefined,
      undefined,
      context
    );
    expect(context.memory.all.map((row) => row.kind)).toEqual(["fact"]);
    expect(context.memory.all[0]?.sourceUrl).toBeNull();
  });

  it("is classified as read for retrieval and draft for the write, and sits before the draft tools", () => {
    expect(tierOf(TOOL_NAMES.searchMemory)).toBe("read");
    expect(tierOf(TOOL_NAMES.getMemory)).toBe("read");
    expect(tierOf(TOOL_NAMES.saveMemory)).toBe("draft");

    const names = createWritingTools().map((tool) => tool.name);
    expect(names.indexOf(TOOL_NAMES.searchMemory)).toBeGreaterThan(
      names.indexOf(TOOL_NAMES.fetchUrl)
    );
    expect(names.indexOf(TOOL_NAMES.saveMemory)).toBeLessThan(
      names.indexOf(TOOL_NAMES.readDraft)
    );
    expect(readOnlyToolNames()).toContain(TOOL_NAMES.saveMemory);
    expect(readOnlyToolNames()).not.toContain(TOOL_NAMES.commitDraft);
  });
});

describe("InMemoryMemoryPort", () => {
  it("keys sources on their URL and reports whether a revisit changed anything", async () => {
    const port = new InMemoryMemoryPort(SESSION_ID);
    const first = await port.save({
      kind: "source",
      title: "pgvector",
      content: "README excerpt",
      sourceUrl: "https://github.com/pgvector/pgvector",
    });
    const again = await port.save({
      kind: "source",
      title: "pgvector",
      content: "README excerpt",
      sourceUrl: "https://github.com/pgvector/pgvector",
    });
    const edited = await port.save({
      kind: "source",
      title: "pgvector",
      content: "README excerpt, updated",
      sourceUrl: "https://github.com/pgvector/pgvector",
    });

    expect(first).toMatchObject({ id: 1, changed: true });
    expect(again).toMatchObject({ id: 1, changed: false });
    expect(edited).toMatchObject({ id: 1, changed: true });
    expect(port.all).toHaveLength(1);
    await expect(port.listBySession(SESSION_ID)).resolves.toHaveLength(1);
  });

  it("degrades a long source to its focused sections instead of dumping the page", async () => {
    const port = new InMemoryMemoryPort(SESSION_ID);
    const sections = Array.from(
      { length: 40 },
      (_, i) => `## Section ${i}\n\n${"word ".repeat(400)}`
    ).join("\n\n");
    await port.save({
      kind: "source",
      title: "Long page",
      content: sections,
      sourceUrl: "https://example.com/long",
    });

    const read = await getMemoryTool.execute(
      "call-1",
      { id: 1, focusHeadings: ["Section 37"] },
      undefined,
      undefined,
      { ...createContext(), memory: port }
    );

    expect(read.details).toMatchObject({ id: 1, detail: "sections" });
    expect(read.content[0]).toMatchObject({
      text: expect.stringContaining("Section 37"),
    });
  });
});
