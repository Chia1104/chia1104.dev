import { describe, expect, it } from "vitest";

import { ContextDetail } from "@chia/ai/embeddings/context";
import { AgentMemoryKind, AgentMemoryStatus } from "@chia/db/schema";

import { InMemoryDraftStore } from "../src/draft/memory-draft-store.ts";
import { InMemoryMemoryPort } from "../src/memory/memory-port.ts";
import {
  getMemoryTool,
  proposeLessonTool,
  saveMemoryTool,
  searchMemoryTool,
} from "../src/tools/memory.tool.ts";
import {
  TOOL_INFO_BY_NAME,
  ToolName,
  toolInfo,
} from "../src/tools/registry.ts";
import { summarizeToolResult } from "../src/tools/summarize.ts";
import { writingToolSpecs } from "../src/tools/tool-set.ts";
import { WritingToolTier } from "../src/types.ts";
import type { WritingToolContext } from "../src/types.ts";

import {
  createFakeContentPort,
  createFakeGitHubPort,
  createFakeWebPort,
} from "./fixtures.ts";

const SESSION_ID = "session-1";

const createContext = (): WritingToolContext & {
  memory: InMemoryMemoryPort;
} => ({
  agentSessionId: SESSION_ID,
  content: createFakeContentPort(),
  web: createFakeWebPort(),
  connectors: { github: createFakeGitHubPort() },
  draft: new InMemoryDraftStore(),
  memory: new InMemoryMemoryPort(SESSION_ID),
  approvedDraftHashes: new Map(),
});

describe("memory tools", () => {
  it("saves a fact and finds it again by search, then reads it by id", async () => {
    const context = createContext();

    const saved = await saveMemoryTool(context).execute("call-1", {
      title: "pgvector 0.8 adds iterative index scans",
      content: "Set `hnsw.iterative_scan = relaxed_order` on pgvector 0.8+.",
      sourceUrl: "https://github.com/pgvector/pgvector#iterative-index-scans",
    });
    expect(saved.details).toMatchObject({ id: 1, kind: AgentMemoryKind.Fact });
    expect(summarizeToolResult(ToolName.SaveMemory, saved, false)).toBe(
      "Saved memory #1."
    );

    const found = await searchMemoryTool(context).execute("call-2", {
      query: "iterative_scan",
    });
    expect(found.details).toMatchObject({
      query: "iterative_scan",
      hits: [
        {
          id: 1,
          kind: AgentMemoryKind.Fact,
          title: expect.stringContaining("pgvector"),
        },
      ],
    });
    expect(found.content[0]).toMatchObject({
      text: expect.stringContaining("(#1)"),
    });
    expect(summarizeToolResult(ToolName.SearchMemory, found, false)).toBe(
      'Searched memory for "iterative_scan" (1 hits).'
    );

    const read = await getMemoryTool(context).execute("call-3", { id: 1 });
    expect(read.content[0]).toMatchObject({
      text: expect.stringContaining("relaxed_order"),
    });
    expect(read.details).toMatchObject({
      id: 1,
      status: AgentMemoryStatus.Active,
      detail: ContextDetail.Full,
    });
  });

  it("tells the model to research when nothing matches, and rejects an unknown id", async () => {
    const context = createContext();

    const found = await searchMemoryTool(context).execute("call-1", {
      query: "nothing",
    });
    expect(found.details).toEqual({
      query: "nothing",
      hits: [],
      answerable: null,
    });
    expect(found.content[0]).toMatchObject({
      text: expect.stringContaining("web_search"),
    });

    await expect(
      getMemoryTool(context).execute("call-2", { id: 42 })
    ).rejects.toThrow("No memory #42");
  });

  it("save_memory only ever writes facts; sources have another author", async () => {
    const context = createContext();
    await saveMemoryTool(context).execute("call-1", {
      title: "A decision",
      content: "Use tabs.",
    });
    expect(context.memory.all.map((row) => row.kind)).toEqual([
      AgentMemoryKind.Fact,
    ]);
    expect(context.memory.all[0]?.sourceUrl).toBeNull();
  });

  it("propose_lesson writes a pending lesson that may supersede an active one", async () => {
    const context = createContext();

    const proposed = await proposeLessonTool(context).execute("call-1", {
      title: "Open with the problem, not the tool",
      content: "The first paragraph names the problem the post solves.",
      supersedes: 3,
    });

    expect(proposed.details).toEqual({
      id: 1,
      kind: AgentMemoryKind.Lesson,
      title: "Open with the problem, not the tool",
      supersedes: 3,
    });
    expect(proposed.content[0]).toMatchObject({
      text: expect.stringContaining("waiting for review"),
    });
    expect(context.memory.all[0]).toMatchObject({
      kind: AgentMemoryKind.Lesson,
      status: AgentMemoryStatus.Pending,
      supersedesId: 3,
      sessionId: SESSION_ID,
    });
    await expect(context.memory.listActiveLessons(10)).resolves.toEqual([]);
    expect(summarizeToolResult(ToolName.ProposeLesson, proposed, false)).toBe(
      "Proposed lesson #1 for review."
    );
  });

  it("propose_lesson revising this session's pending proposal replaces it and keeps its chain", async () => {
    const context = createContext();
    await proposeLessonTool(context).execute("call-1", {
      title: "Open with the problem",
      content: "The first paragraph names the problem.",
      supersedes: 3,
    });
    // the first proposal is #1; the port numbers rows from 1. Two other sessions backed it.
    for (const row of context.memory.all) row.reinforcements = 2;
    const revised = await proposeLessonTool(context).execute("call-2", {
      title: "Open with the problem, not the tool",
      content: "The first paragraph names the problem the post solves.",
      supersedes: 1,
    });

    expect(revised.details).toMatchObject({
      id: 2,
      kind: AgentMemoryKind.Lesson,
    });
    // the revision keeps the chain to the active lesson and the sessions behind the proposal
    expect(context.memory.all).toMatchObject([
      {
        id: 1,
        status: AgentMemoryStatus.Archived,
        supersedesId: 3,
        reinforcements: 2,
      },
      {
        id: 2,
        status: AgentMemoryStatus.Pending,
        supersedesId: 3,
        reinforcements: 2,
      },
    ]);
    await expect(
      context.memory.listBySession(SESSION_ID)
    ).resolves.toMatchObject([
      { id: 1, status: AgentMemoryStatus.Archived },
      { id: 2, status: AgentMemoryStatus.Pending },
    ]);
  });

  it("is classified as read for retrieval and draft for the writes, and sits before the draft tools", () => {
    expect(toolInfo(ToolName.SearchMemory).tier).toBe(WritingToolTier.Read);
    expect(toolInfo(ToolName.GetMemory).tier).toBe(WritingToolTier.Read);
    expect(toolInfo(ToolName.SaveMemory).tier).toBe(WritingToolTier.Draft);
    expect(toolInfo(ToolName.ProposeLesson).tier).toBe(WritingToolTier.Draft);

    const names = writingToolSpecs.map((spec) => spec.name);
    expect(names.indexOf(ToolName.SearchMemory)).toBeGreaterThan(
      names.indexOf(ToolName.FetchUrl)
    );
    expect(names.indexOf(ToolName.SaveMemory)).toBeLessThan(
      names.indexOf(ToolName.ReadDraft)
    );
    const commitTier = Object.entries(TOOL_INFO_BY_NAME)
      .filter(([, info]) => info.tier === WritingToolTier.Commit)
      .map(([name]) => name);
    expect(commitTier).toEqual([ToolName.CommitDraft, ToolName.SetPublished]);
  });
});

describe("InMemoryMemoryPort", () => {
  it("keys sources on their URL and reports whether a revisit changed anything", async () => {
    const port = new InMemoryMemoryPort(SESSION_ID);
    const first = await port.save({
      kind: AgentMemoryKind.Source,
      title: "pgvector",
      content: "README excerpt",
      sourceUrl: "https://github.com/pgvector/pgvector",
    });
    const again = await port.save({
      kind: AgentMemoryKind.Source,
      title: "pgvector",
      content: "README excerpt",
      sourceUrl: "https://github.com/pgvector/pgvector",
    });
    const edited = await port.save({
      kind: AgentMemoryKind.Source,
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
      kind: AgentMemoryKind.Source,
      title: "Long page",
      content: sections,
      sourceUrl: "https://example.com/long",
    });

    const read = await getMemoryTool({
      ...createContext(),
      memory: port,
    }).execute("call-1", { id: 1, focusHeadings: ["Section 37"] });

    expect(read.details).toMatchObject({
      id: 1,
      detail: ContextDetail.Sections,
    });
    expect(read.content[0]).toMatchObject({
      text: expect.stringContaining("Section 37"),
    });
  });
});
