import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import type { AgentMemory } from "@chia/db/schema";

const { repo } = vi.hoisted(() => ({
  repo: {
    getAgentMemory: vi.fn(),
    getAgentMemories: vi.fn(),
  },
}));

vi.mock("@chia/db/repos/agent/memory", () => ({
  getAgentMemory: repo.getAgentMemory,
  getAgentMemories: repo.getAgentMemories,
}));

const { agentMemoryResource, AGENT_MEMORY_SOURCE_TYPE } =
  await import("../resources/agent-memory.resource.ts");
const { getResourceAdapter, isResourceType } =
  await import("../resources/registry.ts");

// SAFETY: every repository call is mocked; nothing reaches the database.
const db = {} as DB;

const memory = (overrides: Partial<AgentMemory> = {}): AgentMemory => ({
  id: 7,
  kind: "fact",
  status: "active",
  title: "pgvector 0.8 adds iterative index scans",
  content:
    "## Iterative scans\n\nSet `hnsw.iterative_scan = relaxed_order` on pgvector 0.8+.\n\n## Why\n\nFiltered queries otherwise under-fetch candidates.",
  sourceUrl: "https://github.com/pgvector/pgvector",
  sessionId: "session-1",
  createdAt: new Date("2026-08-01T00:00:00Z"),
  updatedAt: new Date("2026-08-01T00:00:00Z"),
  deletedAt: null,
  ...overrides,
});

describe("agentMemoryResource", () => {
  beforeEach(() => {
    repo.getAgentMemory.mockReset();
    repo.getAgentMemories.mockReset();
  });

  it("is registered under its source type", () => {
    expect(isResourceType(AGENT_MEMORY_SOURCE_TYPE)).toBe(true);
    expect(getResourceAdapter(AGENT_MEMORY_SOURCE_TYPE)).toBe(
      agentMemoryResource
    );
  });

  it("builds a bounded card plus body sections, never published, without a locale", async () => {
    repo.getAgentMemory.mockResolvedValue(memory());

    const set = await agentMemoryResource.buildChunks(db, 7);

    expect(set?.visibility).toEqual({
      locale: null,
      published: false,
      deleted: false,
    });
    const [card, ...sections] = set?.chunks ?? [];
    expect(card).toMatchObject({
      kind: "card",
      chunkIndex: 0,
      content:
        "Kind: fact\nTitle: pgvector 0.8 adds iterative index scans\nSource: https://github.com/pgvector/pgvector",
    });
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(section.kind).toBe("section");
      expect(section.contentHash).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(sections.some((s) => s.content.includes("relaxed_order"))).toBe(
      true
    );
  });

  it("retires archived and deleted memories from the index and from hydration alike", async () => {
    repo.getAgentMemory.mockResolvedValueOnce(memory({ status: "archived" }));
    await expect(agentMemoryResource.buildChunks(db, 7)).resolves.toBeNull();

    repo.getAgentMemory.mockResolvedValueOnce(
      memory({ deletedAt: new Date() })
    );
    await expect(agentMemoryResource.buildChunks(db, 7)).resolves.toBeNull();

    repo.getAgentMemory.mockResolvedValueOnce(undefined);
    await expect(agentMemoryResource.buildChunks(db, 7)).resolves.toBeNull();

    repo.getAgentMemories.mockResolvedValue([
      memory({ id: 1 }),
      memory({ id: 2, status: "archived" }),
    ]);
    const summaries = await agentMemoryResource.hydrate(db, [1, 2, 3]);
    expect([...summaries.keys()]).toEqual([1]);
    expect(summaries.get(1)).toMatchObject({
      sourceType: AGENT_MEMORY_SOURCE_TYPE,
      sourceId: 1,
      href: null,
      locale: null,
    });
  });

  it("asks the repository for nothing when there is nothing to hydrate", async () => {
    await expect(agentMemoryResource.hydrate(db, [])).resolves.toEqual(
      new Map()
    );
    expect(repo.getAgentMemories).not.toHaveBeenCalled();
  });
});
