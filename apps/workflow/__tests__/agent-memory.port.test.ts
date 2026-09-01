import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DB } from "@chia/db/client";

import { createAgentMemoryPort } from "../src/services/agent-memory.port";

const { api, repo, hooks } = vi.hoisted(() => ({
  api: {
    searchResources: vi.fn(
      async (): Promise<{ mode: string; items: unknown[] }> => ({
        mode: "hybrid",
        items: [],
      })
    ),
    createMemoryService: vi.fn(),
    recordSourceMemoryService: vi.fn(),
  },
  repo: {
    getAgentMemory: vi.fn(),
    getAgentMemories: vi.fn(),
    listAgentMemoriesBySession: vi.fn(async () => []),
    listActiveAgentLessons: vi.fn(async () => []),
  },
  hooks: { memoryHooks: { onMemoryChanged: vi.fn() } },
}));

vi.mock("@chia/api/resources/search", () => ({
  searchResources: api.searchResources,
}));
vi.mock("@chia/api/memories/write", () => ({
  createMemoryService: api.createMemoryService,
  recordSourceMemoryService: api.recordSourceMemoryService,
}));
vi.mock("@chia/db/repos/agent/memory", () => repo);
vi.mock("../src/services/agent-memory-indexing.service", () => hooks);

/**
 * The two flags a caller must set together to see a memory: every memory chunk is indexed
 * `published: false`, so a search that forgets either `includeUnpublished` or the source
 * type gets nothing, and a public search can never get a memory by accident.
 */

const SESSION_ID = "session-1";
// SAFETY: every repository call is mocked, so the port never dereferences the connection.
const db = {} as DB;

const row = (id: number, overrides: { deletedAt?: Date | null } = {}) => ({
  id,
  kind: "fact",
  status: "active",
  title: `Memory ${id}`,
  content: "body",
  sourceUrl: "https://example.com/",
  sessionId: SESSION_ID,
  createdAt: new Date("2026-08-01T00:00:00Z"),
  updatedAt: new Date("2026-08-02T00:00:00Z"),
  deletedAt: null,
  ...overrides,
});

describe("createAgentMemoryPort", () => {
  const port = createAgentMemoryPort({ db, sessionId: SESSION_ID });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches only the memory type and asks for unpublished chunks", async () => {
    api.searchResources.mockResolvedValueOnce({
      mode: "hybrid",
      items: [
        {
          sourceType: "agent_memory",
          sourceId: 2,
          score: 1,
          matchedChunks: 1,
          bestChunk: {
            content: "x".repeat(600),
            headingPath: "Setup > Install",
          },
          summary: {},
        },
        {
          sourceType: "agent_memory",
          sourceId: 1,
          score: 0.5,
          matchedChunks: 1,
          bestChunk: { content: "short", headingPath: null },
          summary: {},
        },
      ],
    });
    repo.getAgentMemories.mockResolvedValueOnce([row(1), row(2)]);

    const hits = await port.search({ query: "q", limit: 5 });

    expect(api.searchResources).toHaveBeenCalledWith(
      expect.objectContaining({
        db,
        query: "q",
        mode: "hybrid",
        sourceTypes: ["agent_memory"],
        includeUnpublished: true,
        limit: 5,
      })
    );
    // Result order is the search order, and the snippet is bounded.
    expect(hits.map((hit) => hit.id)).toEqual([2, 1]);
    expect(hits[0]?.snippet).toHaveLength(501);
    expect(hits[0]?.headingPath).toBe("Setup > Install");
    expect(hits[1]).toMatchObject({ kind: "fact", snippet: "short" });
  });

  it("writes facts through the write service with the session as provenance", async () => {
    api.createMemoryService.mockResolvedValueOnce(row(3));

    const saved = await port.save({
      kind: "fact",
      title: "t",
      content: "c",
      sourceUrl: "https://example.com/",
    });

    expect(api.createMemoryService).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ kind: "fact", sessionId: SESSION_ID }),
      hooks.memoryHooks
    );
    expect(saved).toMatchObject({ id: 3, changed: true });
  });

  it("records sources by URL and reports whether the revisit changed anything", async () => {
    api.recordSourceMemoryService.mockResolvedValueOnce({
      id: 4,
      changed: false,
    });

    const saved = await port.save({
      kind: "source",
      title: "Example",
      content: "excerpt",
      sourceUrl: "https://example.com/",
    });

    expect(api.recordSourceMemoryService).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        sourceUrl: "https://example.com/",
        sessionId: SESSION_ID,
      }),
      hooks.memoryHooks
    );
    expect(saved).toMatchObject({ id: 4, kind: "source", changed: false });
    await expect(
      port.save({ kind: "source", title: "t", content: "c" })
    ).rejects.toThrow("needs its URL");
  });

  it("does not read back a soft-deleted memory", async () => {
    repo.getAgentMemory.mockResolvedValueOnce(
      row(5, { deletedAt: new Date() })
    );
    await expect(port.get(5)).resolves.toBeNull();

    repo.getAgentMemory.mockResolvedValueOnce(row(5));
    await expect(port.get(5)).resolves.toMatchObject({
      id: 5,
      content: "body",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
  });
});
