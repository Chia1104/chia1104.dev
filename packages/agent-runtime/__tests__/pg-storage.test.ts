import type { Usage } from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import {
  appendAgentSessionEntryAsLeaf,
  getAgentSession,
  getAgentSessionEntries,
} from "@chia/db/repos/agent";
import type { JsonObject } from "@chia/utils/json";

import type { NewSessionEntry } from "../src/session/entries.ts";
import { PgSessionStorage } from "../src/session/pg-storage.ts";

vi.mock("@chia/db/repos/agent", () => ({
  appendAgentSessionEntryAsLeaf: vi.fn(),
  getAgentSession: vi.fn(),
  getAgentSessionEntries: vi.fn(),
  getAgentSessionEntriesByType: vi.fn(),
  getAgentSessionEntry: vi.fn(),
  updateAgentSession: vi.fn(),
}));

const appendEntryMock = vi.mocked(appendAgentSessionEntryAsLeaf);
const getSessionMock = vi.mocked(getAgentSession);
const getEntriesMock = vi.mocked(getAgentSessionEntries);

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

const db =
  /* SAFETY: This fixture implements the DB members exercised by this case. */ {} as DB;

const storage = () =>
  new PgSessionStorage(db, {
    id: "session-1",
    createdAt: "2026-07-27T00:00:00.000Z",
    userId: "user-1",
    kind: "writing",
  });

const row = (
  seq: number,
  id: string,
  parentId: string | null,
  type: string,
  payload: JsonObject
) => ({
  seq,
  id,
  sessionId: "session-1",
  parentId,
  type,
  payload,
  timestamp: new Date(`2026-07-27T00:00:0${seq}.000Z`),
});

describe("PgSessionStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appends an entry, advances the leaf in one write and returns the seq it landed on", async () => {
    appendEntryMock.mockResolvedValue({ seq: 7 });
    const entry = {
      type: "label",
      id: "entry-1",
      parentId: null,
      timestamp: Date.parse("2026-07-27T00:00:01.000Z"),
      targetId: "entry-0",
      label: "Start",
    } satisfies NewSessionEntry;

    const stored = await storage().appendEntry(entry);

    expect(appendEntryMock).toHaveBeenCalledOnce();
    expect(appendEntryMock).toHaveBeenCalledWith(db, {
      id: "entry-1",
      sessionId: "session-1",
      parentId: null,
      type: "label",
      payload: { targetId: "entry-0", label: "Start" },
      timestamp: new Date("2026-07-27T00:00:01.000Z"),
    });
    expect(stored).toEqual({ ...entry, seq: 7 });
  });

  it("reads the leaf from the session row", async () => {
    getSessionMock.mockResolvedValue(
      /* SAFETY: This fixture implements the session row members exercised by this case. */ {
        leafEntryId: "entry-2",
      } as never
    );

    await expect(storage().getLeafId()).resolves.toBe("entry-2");
  });

  it("projects rows back into entries with their seq, a numeric timestamp and a tail on compactions", async () => {
    getEntriesMock.mockResolvedValue(
      /* SAFETY: These rows implement the repository shape exercised by this case. */ [
        row(1, "entry-1", null, "compaction", {
          summary: "Summary",
          tokensBefore: 10,
        }),
      ] as never
    );

    const [entry] = await storage().getEntries();

    expect(entry).toEqual({
      type: "compaction",
      id: "entry-1",
      parentId: null,
      seq: 1,
      timestamp: Date.parse("2026-07-27T00:00:01.000Z"),
      summary: "Summary",
      tokensBefore: 10,
      retainedTail: [],
    });
  });

  it("walks a branch by parent links, not by seq", async () => {
    // entry-3 was appended after a rewind to entry-1: newer by seq, on a different branch.
    getEntriesMock.mockResolvedValue(
      /* SAFETY: These rows implement the repository shape exercised by this case. */ [
        row(1, "entry-1", null, "message", { message: { role: "user" } }),
        row(2, "entry-2", "entry-1", "message", { message: { role: "user" } }),
        row(3, "entry-3", "entry-1", "message", { message: { role: "user" } }),
      ] as never
    );

    const branch = await storage().getBranch("entry-3");

    expect(branch.map((entry) => [entry.id, entry.seq])).toEqual([
      ["entry-1", 1],
      ["entry-3", 3],
    ]);
  });

  it("counts cached, written and compaction tokens as total processed", async () => {
    getEntriesMock.mockResolvedValue(
      /* SAFETY: These rows implement the repository shape exercised by this case. */ [
        row(1, "entry-1", null, "message", {
          message: { role: "user", content: "Hello" },
        }),
        row(2, "entry-2", "entry-1", "message", {
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
        }),
        row(3, "entry-3", "entry-2", "compaction", {
          summary: "Summary",
          tokensBefore: 460,
          usage: usage({ input: 10, output: 5, costTotal: 0.1 }),
        }),
      ] as never
    );

    const stats = await storage().getSessionStats();

    expect(stats).toMatchObject({
      messageCount: 2,
      cachedTokens: 300,
      uncachedTokens: 150,
      totalTokens: 475,
    });
    expect(stats.costTotal).toBeCloseTo(0.6);
  });
});
