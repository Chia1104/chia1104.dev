import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";

const { repo } = vi.hoisted(() => ({
  repo: {
    createAgentMemory: vi.fn(),
    updateAgentMemory: vi.fn(),
    softDeleteAgentMemory: vi.fn(),
    upsertSourceMemory: vi.fn(),
  },
}));

vi.mock("@chia/db/repos/agent/memory", () => repo);

const {
  createMemoryService,
  normalizeSourceUrl,
  recordSourceMemoryService,
  removeMemoryService,
  updateMemoryService,
} = await import("../memories/write.ts");

// SAFETY: every repository call is mocked; nothing reaches the database.
const db = {} as DB;

const row = (id: number) => ({
  id,
  kind: "fact",
  status: "active",
  title: "t",
  content: "c",
  sourceUrl: null,
  sessionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
});

describe("memory write services", () => {
  const onMemoryChanged = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    repo.createAgentMemory.mockImplementation(async () => row(1));
    repo.updateAgentMemory.mockImplementation(async () => row(1));
    repo.softDeleteAgentMemory.mockResolvedValue(true);
  });

  it("indexes after every create, update and removal", async () => {
    await createMemoryService(
      db,
      { kind: "fact", title: " t ", content: " c " },
      { onMemoryChanged }
    );
    expect(repo.createAgentMemory).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ title: "t", content: "c", sourceUrl: null })
    );

    await updateMemoryService(
      db,
      { id: 1, status: "archived" },
      {
        onMemoryChanged,
      }
    );
    await removeMemoryService(db, { id: 1 }, { onMemoryChanged });

    expect(onMemoryChanged.mock.calls).toEqual([[1], [1], [1]]);
  });

  it("rejects empty or oversized content before touching the repository", async () => {
    await expect(
      createMemoryService(db, { kind: "fact", title: "t", content: "  " }, {})
    ).rejects.toThrow("needs content");
    await expect(
      createMemoryService(
        db,
        { kind: "fact", title: "t", content: "x".repeat(16_001) },
        {}
      )
    ).rejects.toThrow("at most 16000");
    expect(repo.createAgentMemory).not.toHaveBeenCalled();
  });

  it("keeps only web URLs and drops the fragment", () => {
    expect(normalizeSourceUrl("https://example.com/a?b=1#c")).toBe(
      "https://example.com/a?b=1"
    );
    expect(() => normalizeSourceUrl("file:///etc/passwd")).toThrow(
      "http or https"
    );
    expect(() => normalizeSourceUrl("not a url")).toThrow("absolute URL");
  });

  it("re-indexes a source only when the page text changed", async () => {
    repo.upsertSourceMemory.mockResolvedValueOnce({ id: 9, changed: true });
    repo.upsertSourceMemory.mockResolvedValueOnce({ id: 9, changed: false });
    const input = {
      sourceUrl: "https://example.com/#top",
      title: "Example",
      content: "excerpt",
      sessionId: "session-1",
    };

    await recordSourceMemoryService(db, input, { onMemoryChanged });
    await recordSourceMemoryService(db, input, { onMemoryChanged });

    expect(repo.upsertSourceMemory).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ sourceUrl: "https://example.com/" })
    );
    expect(onMemoryChanged).toHaveBeenCalledTimes(1);
  });

  it("reports a missing memory as not found", async () => {
    repo.updateAgentMemory.mockResolvedValueOnce(undefined);
    await expect(
      updateMemoryService(db, { id: 404, title: "x" }, {})
    ).rejects.toThrow("not found");
    repo.softDeleteAgentMemory.mockResolvedValueOnce(false);
    await expect(removeMemoryService(db, { id: 404 }, {})).rejects.toThrow(
      "not found"
    );
  });
});
