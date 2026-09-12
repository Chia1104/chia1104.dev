import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import type { AgentMemory } from "@chia/db/schema";

const { repo } = vi.hoisted(() => ({
  repo: {
    approveAgentLesson: vi.fn(),
    createAgentMemory: vi.fn(),
    getAgentMemory: vi.fn(),
    reinforceAgentMemory: vi.fn(),
    updateAgentMemory: vi.fn(),
    softDeleteAgentMemory: vi.fn(),
    upsertSourceMemory: vi.fn(),
  },
}));

vi.mock("@chia/db/repos/agent/memory", () => repo);

const { isResourceIndexedSince } = vi.hoisted(() => ({
  isResourceIndexedSince: vi.fn(async () => true),
}));
vi.mock("@chia/db/repos/resources/chunk", () => ({ isResourceIndexedSince }));

const {
  approveLessonService,
  createMemoryService,
  normalizeSourceUrl,
  recordSourceMemoryService,
  reinforceLessonService,
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
  supersedesId: null,
  reinforcements: 0,
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
        { kind: "fact", title: "t", content: "x".repeat(64_001) },
        {}
      )
    ).rejects.toThrow("at most 64000");
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

  it("re-indexes a source when the page text changed, or when the index is older than the row", async () => {
    const updatedAt = new Date("2026-08-27T00:00:00Z");
    repo.upsertSourceMemory.mockResolvedValueOnce({
      id: 9,
      changed: true,
      updatedAt,
    });
    repo.upsertSourceMemory.mockResolvedValueOnce({
      id: 9,
      changed: false,
      updatedAt,
    });
    repo.upsertSourceMemory.mockResolvedValueOnce({
      id: 9,
      changed: false,
      updatedAt,
    });
    isResourceIndexedSince.mockResolvedValueOnce(true);
    isResourceIndexedSince.mockResolvedValueOnce(false);
    const input = {
      sourceUrl: "https://example.com/#top",
      title: "Example",
      content: "excerpt",
      sessionId: "session-1",
    };

    await recordSourceMemoryService(db, input, { onMemoryChanged });
    await recordSourceMemoryService(db, input, { onMemoryChanged });
    // a hook that failed after the row landed leaves the index behind the row, whether
    // there are no chunks or stale ones; the next visit retries
    await recordSourceMemoryService(db, input, { onMemoryChanged });

    expect(repo.upsertSourceMemory).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ sourceUrl: "https://example.com/" })
    );
    expect(isResourceIndexedSince).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ since: updatedAt })
    );
    expect(onMemoryChanged).toHaveBeenCalledTimes(2);
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

describe("lesson review services", () => {
  const onMemoryChanged = vi.fn(async () => undefined);
  const lesson = (overrides: Partial<AgentMemory>) => ({
    ...row(7),
    kind: "lesson",
    status: "pending",
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repo.createAgentMemory.mockImplementation(async () => lesson({}));
    repo.approveAgentLesson.mockImplementation(async (_db, id: number) => ({
      status: "approved",
      approved: lesson({ id, status: "active" }),
      archived: null,
    }));
  });

  it("lets only a pending lesson supersede, and only an active lesson", async () => {
    const proposal = {
      kind: "lesson",
      status: "pending",
      title: "t",
      content: "c",
      supersedesId: 3,
    } as const;
    repo.getAgentMemory.mockResolvedValueOnce(
      lesson({ id: 3, status: "active" })
    );
    await createMemoryService(db, proposal, { onMemoryChanged });
    expect(repo.createAgentMemory).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ supersedesId: 3 })
    );

    repo.getAgentMemory.mockResolvedValueOnce(row(3));
    await expect(createMemoryService(db, proposal, {})).rejects.toThrow(
      "not an active lesson"
    );
    // an active lesson that supersedes would skip the approval that archives its target
    await expect(
      createMemoryService(db, { ...proposal, status: undefined }, {})
    ).rejects.toThrow("Only a pending lesson supersedes");
    await expect(
      createMemoryService(db, { ...proposal, kind: "fact" }, {})
    ).rejects.toThrow("Only a pending lesson supersedes");
    expect(repo.createAgentMemory).toHaveBeenCalledTimes(1);
  });

  it("approves a lesson in one repository step and re-indexes it and the one it archived", async () => {
    repo.getAgentMemory.mockResolvedValueOnce(lesson({ supersedesId: 3 }));
    repo.approveAgentLesson.mockResolvedValueOnce({
      status: "approved",
      approved: lesson({ status: "active", supersedesId: 3 }),
      archived: lesson({ id: 3, status: "archived" }),
    });

    const approved = await approveLessonService(
      db,
      { id: 7 },
      { onMemoryChanged }
    );

    expect(approved.status).toBe("active");
    expect(repo.approveAgentLesson).toHaveBeenCalledWith(db, 7);
    expect(repo.updateAgentMemory).not.toHaveBeenCalled();
    expect(onMemoryChanged.mock.calls).toEqual([[3], [7]]);
  });

  it("approves only a live pending lesson, once", async () => {
    repo.getAgentMemory.mockResolvedValueOnce(lesson({ kind: "fact" }));
    await expect(approveLessonService(db, { id: 7 }, {})).rejects.toThrow(
      "not a lesson"
    );
    repo.getAgentMemory.mockResolvedValueOnce(
      lesson({ deletedAt: new Date() })
    );
    await expect(approveLessonService(db, { id: 7 }, {})).rejects.toThrow(
      "not found"
    );
    repo.getAgentMemory.mockResolvedValueOnce(lesson({ status: "archived" }));
    await expect(approveLessonService(db, { id: 7 }, {})).rejects.toThrow(
      "only a pending lesson"
    );
    expect(repo.approveAgentLesson).not.toHaveBeenCalled();

    // read as pending, but another approval got to the row first
    repo.getAgentMemory.mockResolvedValueOnce(lesson({}));
    repo.approveAgentLesson.mockResolvedValueOnce({ status: "not_pending" });
    await expect(
      approveLessonService(db, { id: 7 }, { onMemoryChanged })
    ).rejects.toThrow("reviewed by someone else");

    // the lesson it revises was already replaced by another approved revision
    repo.getAgentMemory.mockResolvedValueOnce(lesson({ supersedesId: 3 }));
    repo.approveAgentLesson.mockResolvedValueOnce({
      status: "already_replaced",
      by: 9,
    });
    await expect(
      approveLessonService(db, { id: 7 }, { onMemoryChanged })
    ).rejects.toThrow("#9 already replaced");
    expect(onMemoryChanged).not.toHaveBeenCalled();
  });

  it("reports whether a reinforcement found a pending lesson", async () => {
    repo.reinforceAgentMemory.mockResolvedValueOnce(lesson({}));
    await expect(reinforceLessonService(db, { id: 7 })).resolves.toBe(true);
    repo.reinforceAgentMemory.mockResolvedValueOnce(undefined);
    await expect(reinforceLessonService(db, { id: 8 })).resolves.toBe(false);
  });
});
