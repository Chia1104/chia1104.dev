import type { Usage } from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import {
  appendAgentSessionEntry,
  getAgentSession,
  getAgentSessionEntries,
  updateAgentSession,
} from "@chia/db/repos/agent";

import type { SessionEntry } from "../src/session/entries.ts";
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

const usage = ({
  cacheRead = 0,
  cacheWrite = 0,
  costTotal = 0,
  input,
  output,
}: {
  cacheRead?: number;
  cacheWrite?: number;
  costTotal?: number;
  input: number;
  output: number;
}): Usage => ({
  input,
  output,
  cacheRead,
  cacheWrite,
  totalTokens: input + output + cacheRead + cacheWrite,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: costTotal,
  },
});

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
    const db =
      /* SAFETY: This fixture implements the DB members exercised by this case. */ {} as DB;
    const storage = new PgSessionStorage(db, {
      id: "session-1",
      createdAt: "2026-07-27T00:00:00.000Z",
      userId: "user-1",
      kind: "writing",
    });
    const entry = {
      type: "label",
      id: "entry-1",
      parentId: null,
      timestamp: Date.parse("2026-07-27T00:00:01.000Z"),
      targetId: "entry-0",
      label: "Start",
    } satisfies SessionEntry;

    await storage.appendEntry(entry);

    expect(appendEntryMock).toHaveBeenCalledWith(db, {
      id: "entry-1",
      sessionId: "session-1",
      parentId: null,
      type: "label",
      payload: { targetId: "entry-0", label: "Start" },
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
    getSessionMock.mockResolvedValue(
      /* SAFETY: This fixture implements the never members exercised by this case. */ {
        leafEntryId: null,
      } as never
    );
    getEntriesMock.mockResolvedValue([...legacyEntries]);
    const storage = new PgSessionStorage(
      /* SAFETY: This fixture implements the DB members exercised by this case. */ {} as DB,
      {
        id: "session-1",
        createdAt: "2026-07-27T00:00:00.000Z",
        userId: "user-1",
        kind: "writing",
      }
    );

    await expect(storage.getLeafId()).resolves.toBe("entry-2");
  });

  it("projects rows back into entries with a numeric timestamp and a tail on compactions", async () => {
    getEntriesMock.mockResolvedValue(
      /* SAFETY: These rows implement the repository shape exercised by this case. */ [
        {
          seq: 1,
          id: "entry-1",
          sessionId: "session-1",
          parentId: null,
          type: "compaction",
          payload: { summary: "Summary", tokensBefore: 10 },
          timestamp: new Date("2026-07-27T00:00:01.000Z"),
        },
      ] as never
    );
    const storage = new PgSessionStorage(
      /* SAFETY: This fixture implements the DB members exercised by this case. */ {} as DB,
      {
        id: "session-1",
        createdAt: "2026-07-27T00:00:00.000Z",
        userId: "user-1",
        kind: "writing",
      }
    );

    const [entry] = await storage.getEntries();

    expect(entry).toEqual({
      type: "compaction",
      id: "entry-1",
      parentId: null,
      timestamp: Date.parse("2026-07-27T00:00:01.000Z"),
      summary: "Summary",
      tokensBefore: 10,
      retainedTail: [],
    });
  });

  it("reconstructs the legacy root prefix when reading a branch", async () => {
    getEntriesMock.mockResolvedValue([...legacyEntries]);
    const storage = new PgSessionStorage(
      /* SAFETY: This fixture implements the DB members exercised by this case. */ {} as DB,
      {
        id: "session-1",
        createdAt: "2026-07-27T00:00:00.000Z",
        userId: "user-1",
        kind: "writing",
      }
    );

    const branch = await storage.getBranch("entry-2");

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
    const storage = new PgSessionStorage(
      /* SAFETY: This fixture implements the DB members exercised by this case. */ {} as DB,
      {
        id: "session-1",
        createdAt: "2026-07-27T00:00:00.000Z",
        userId: "user-1",
        kind: "writing",
      }
    );

    const branch = await storage.getBranch("entry-3");

    expect(branch.map((entry) => entry.id)).toEqual(["entry-3"]);
  });

  it("counts cached, written and compaction tokens as total processed", async () => {
    getEntriesMock.mockResolvedValue(
      /* SAFETY: These rows implement the repository shape exercised by this case. */ [
        {
          seq: 1,
          id: "entry-1",
          sessionId: "session-1",
          parentId: null,
          type: "message",
          payload: { message: { role: "user", content: "Hello" } },
          timestamp: new Date("2026-07-27T00:00:01.000Z"),
        },
        {
          seq: 2,
          id: "entry-2",
          sessionId: "session-1",
          parentId: "entry-1",
          type: "message",
          payload: {
            message: {
              role: "assistant",
              content: [{ type: "text", text: "Hi" }],
              usage: usage({
                input: 100,
                output: 20,
                cacheRead: 300,
                cacheWrite: 40,
                costTotal: 0.5,
              }),
            },
          },
          timestamp: new Date("2026-07-27T00:00:02.000Z"),
        },
        {
          seq: 3,
          id: "entry-3",
          sessionId: "session-1",
          parentId: "entry-2",
          type: "compaction",
          payload: {
            summary: "Summary",
            tokensBefore: 460,
            usage: usage({ input: 10, output: 5, costTotal: 0.1 }),
          },
          timestamp: new Date("2026-07-27T00:00:03.000Z"),
        },
      ] as never
    );
    const storage = new PgSessionStorage(
      /* SAFETY: This fixture implements the DB members exercised by this case. */ {} as DB,
      {
        id: "session-1",
        createdAt: "2026-07-27T00:00:00.000Z",
        userId: "user-1",
        kind: "writing",
      }
    );

    const stats = await storage.getSessionStats();

    expect(stats).toMatchObject({
      messageCount: 2,
      cachedTokens: 300,
      uncachedTokens: 150,
      totalTokens: 475,
    });
    expect(stats.costTotal).toBeCloseTo(0.6);
  });
});
