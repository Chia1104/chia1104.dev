import type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db";
import {
  appendAgentSessionEntry,
  getAgentSession,
  getAgentSessionEntries,
  updateAgentSession,
} from "@chia/db/repos/agent";

import { PgSessionStorage } from "../src/session/pg-storage.ts";

vi.mock("@chia/db/repos/agent", () => ({
  appendAgentSessionEntry: vi.fn(),
  getAgentSession: vi.fn(),
  getAgentSessionEntries: vi.fn(),
  getAgentSessionEntriesByType: vi.fn(),
  getAgentSessionEntry: vi.fn(),
  updateAgentSession: vi.fn(),
}));

const appendEntryMock = vi.mocked(appendAgentSessionEntry);
const getSessionMock = vi.mocked(getAgentSession);
const getEntriesMock = vi.mocked(getAgentSessionEntries);
const updateSessionMock = vi.mocked(updateAgentSession);

const legacyEntries = [
  {
    seq: 1,
    id: "entry-1",
    sessionId: "session-1",
    parentId: null,
    type: "session_info",
    payload: { name: "First" },
    timestamp: new Date("2026-07-27T00:00:01.000Z"),
  },
  {
    seq: 2,
    id: "entry-2",
    sessionId: "session-1",
    parentId: null,
    type: "session_info",
    payload: { name: "Second" },
    timestamp: new Date("2026-07-27T00:00:02.000Z"),
  },
] as const;

describe("PgSessionStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("advances the active leaf after appending an entry", async () => {
    const db = {} as DB;
    const storage = new PgSessionStorage(db, "session-1", {
      id: "session-1",
      createdAt: "2026-07-27T00:00:00.000Z",
      userId: "user-1",
      kind: "writing",
    });
    const entry = {
      type: "session_info",
      id: "entry-1",
      parentId: null,
      timestamp: "2026-07-27T00:00:01.000Z",
      name: "Test session",
    } satisfies SessionTreeEntry;

    await storage.appendEntry(entry);

    expect(appendEntryMock).toHaveBeenCalledWith(db, {
      id: "entry-1",
      sessionId: "session-1",
      parentId: null,
      type: "session_info",
      payload: { name: "Test session" },
      timestamp: new Date("2026-07-27T00:00:01.000Z"),
    });
    expect(updateSessionMock).toHaveBeenCalledWith(db, "session-1", {
      leafEntryId: "entry-1",
    });
    expect(appendEntryMock.mock.invocationCallOrder[0]).toBeLessThan(
      updateSessionMock.mock.invocationCallOrder[0] ?? 0
    );
  });

  it("recovers the leaf from a legacy flat entry sequence", async () => {
    getSessionMock.mockResolvedValue({ leafEntryId: null } as never);
    getEntriesMock.mockResolvedValue([...legacyEntries]);
    const storage = new PgSessionStorage({} as DB, "session-1", {
      id: "session-1",
      createdAt: "2026-07-27T00:00:00.000Z",
      userId: "user-1",
      kind: "writing",
    });

    await expect(storage.getLeafId()).resolves.toBe("entry-2");
  });

  it("reconstructs the legacy root prefix when reading a branch", async () => {
    getEntriesMock.mockResolvedValue([...legacyEntries]);
    const storage = new PgSessionStorage({} as DB, "session-1", {
      id: "session-1",
      createdAt: "2026-07-27T00:00:00.000Z",
      userId: "user-1",
      kind: "writing",
    });

    const branch = await storage.getPathToRootOrCompaction("entry-2");

    expect(branch.map((entry) => entry.id)).toEqual(["entry-1", "entry-2"]);
    expect(branch[1]?.parentId).toBe("entry-1");
  });

  it("does not join a legitimate root created after linked entries", async () => {
    getEntriesMock.mockResolvedValue([
      legacyEntries[0],
      { ...legacyEntries[1], parentId: "entry-1" },
      {
        ...legacyEntries[1],
        seq: 3,
        id: "entry-3",
        payload: { name: "New root" },
      },
    ]);
    const storage = new PgSessionStorage({} as DB, "session-1", {
      id: "session-1",
      createdAt: "2026-07-27T00:00:00.000Z",
      userId: "user-1",
      kind: "writing",
    });

    const branch = await storage.getPathToRootOrCompaction("entry-3");

    expect(branch.map((entry) => entry.id)).toEqual(["entry-3"]);
  });
});
