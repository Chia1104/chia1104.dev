import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import {
  appendAgentSessionEntryAsLeaf,
  createAgentSession,
  getAgentSessionEntries,
  getAgentSessionEntry,
  updateAgentSession,
} from "@chia/db/repos/agent";
import type { AgentSession } from "@chia/db/schema";

import { PgSessionRepo, settingsFromRow } from "../src/session/pg-repo.ts";

vi.mock("@chia/db/repos/agent", () => ({
  appendAgentSessionEntryAsLeaf: vi.fn(),
  createAgentSession: vi.fn(),
  getAgentSessions: vi.fn(),
  getAgentSessionEntries: vi.fn(),
  getAgentSessionEntry: vi.fn(),
  updateAgentSession: vi.fn(),
}));

const db =
  /* SAFETY: every repository call in this suite is mocked; nothing reads the handle. */ {} as DB;

const sessionRow: AgentSession = {
  id: "session-1",
  kind: "writing",
  userId: "user-1",
  title: "Original",
  providerId: "faux",
  modelId: "test-model",
  thinkingLevel: "off",
  activeToolNames: null,
  autoApprove: [],
  runtimeConfig: {},
  configVersion: 1,
  leafEntryId: "a2",
  forkedFromSessionId: null,
  forkedFromEntryId: null,
  createdAt: new Date("2026-07-27T00:00:00.000Z"),
  updatedAt: new Date("2026-07-27T00:00:00.000Z"),
  deletedAt: null,
};

const row = (
  seq: number,
  id: string,
  parentId: string | null,
  role: "user" | "assistant"
) => ({
  seq,
  id,
  sessionId: "session-1",
  parentId,
  type: "message",
  payload: { message: { role, content: `${role} ${id}` } },
  timestamp: new Date(`2026-07-27T00:00:0${seq}.000Z`),
});

const rows = [
  row(1, "u1", null, "user"),
  row(2, "a1", "u1", "assistant"),
  row(3, "u2", "a1", "user"),
  row(4, "a2", "u2", "assistant"),
];

describe("PgSessionRepo.fork", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(appendAgentSessionEntryAsLeaf).mockResolvedValue({ seq: 1 });
    vi.mocked(getAgentSessionEntries).mockResolvedValue(rows);
    vi.mocked(getAgentSessionEntry).mockImplementation(
      async (_db, _sessionId, id) =>
        rows.find((candidate) => candidate.id === id)
    );
  });

  const repo = () => new PgSessionRepo(db, "writing");

  it("copies the branch below a user message so it can be re-asked", async () => {
    const forked = await repo().fork(sessionRow, {
      id: "fork-1",
      entryId: "u2",
      position: "before",
    });

    expect(forked.id).toBe("fork-1");
    expect(vi.mocked(createAgentSession)).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        id: "fork-1",
        userId: "user-1",
        title: "Original",
        forkedFromSessionId: "session-1",
        forkedFromEntryId: "u2",
      })
    );
    expect(
      vi
        .mocked(appendAgentSessionEntryAsLeaf)
        .mock.calls.map(([, input]) => [input.id, input.sessionId])
    ).toEqual([
      ["u1", "fork-1"],
      ["a1", "fork-1"],
    ]);
    // The source's seq is storage-assigned there; the copy takes its own and never stores the old one.
    for (const [, input] of vi.mocked(appendAgentSessionEntryAsLeaf).mock
      .calls) {
      expect(input.payload).not.toHaveProperty("seq");
    }
    // A branch fork ends on its last copied entry; nothing moves the leaf afterwards.
    expect(vi.mocked(updateAgentSession)).not.toHaveBeenCalled();
  });

  it("copies through the target when forking at it", async () => {
    await repo().fork(sessionRow, {
      id: "fork-1",
      entryId: "a1",
      position: "at",
    });

    expect(
      vi
        .mocked(appendAgentSessionEntryAsLeaf)
        .mock.calls.map(([, input]) => input.id)
    ).toEqual(["u1", "a1"]);
  });

  it("refuses to fork before an assistant message", async () => {
    await expect(
      repo().fork(sessionRow, { entryId: "a1", position: "before" })
    ).rejects.toThrow("is not a user message");
  });

  it("copies every entry and the source's leaf when no target is given", async () => {
    // The source was rewound: its leaf is not its newest entry.
    await repo().fork({ ...sessionRow, leafEntryId: "a1" }, { id: "fork-1" });

    // The lineage names the source's leaf, the point the copy is effectively taken from.
    expect(vi.mocked(createAgentSession)).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        forkedFromSessionId: "session-1",
        forkedFromEntryId: "a1",
      })
    );
    expect(
      vi
        .mocked(appendAgentSessionEntryAsLeaf)
        .mock.calls.map(([, input]) => input.id)
    ).toEqual(["u1", "a1", "u2", "a2"]);
    expect(vi.mocked(updateAgentSession)).toHaveBeenLastCalledWith(
      db,
      "fork-1",
      { leafEntryId: "a1" }
    );
  });
});

describe("PgSessionRepo.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("leaves the model unset when the caller chose none, so the row follows the kind default", async () => {
    await new PgSessionRepo(db, "writing").create({
      id: "s-1",
      userId: "user-1",
      defaults: { thinkingLevel: "low" },
    });

    expect(vi.mocked(createAgentSession)).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        providerId: null,
        modelId: null,
        thinkingLevel: "low",
      })
    );
  });

  it("stores the pair the caller chose", async () => {
    await new PgSessionRepo(db, "writing").create({
      id: "s-1",
      userId: "user-1",
      settings: { providerId: "faux", modelId: "chosen" },
      defaults: {},
    });

    expect(vi.mocked(createAgentSession)).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ providerId: "faux", modelId: "chosen" })
    );
  });

  it("forks an unpinned session as unpinned", async () => {
    vi.mocked(getAgentSessionEntries).mockResolvedValue([]);
    await new PgSessionRepo(db, "writing").fork(
      { ...sessionRow, providerId: null, modelId: null },
      { id: "fork-1" }
    );

    expect(vi.mocked(createAgentSession)).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ providerId: null, modelId: null })
    );
  });
});

describe("settingsFromRow", () => {
  const house = { providerId: "faux", modelId: "house" };

  it("runs an unpinned row on the house model", () => {
    expect(
      settingsFromRow({ ...sessionRow, providerId: null, modelId: null }, house)
    ).toMatchObject({ providerId: "faux", modelId: "house" });
  });

  it("keeps a pinned row's own model", () => {
    expect(settingsFromRow(sessionRow, house)).toMatchObject({
      providerId: "faux",
      modelId: "test-model",
    });
  });

  it("rejects a row without a thinking level", () => {
    expect(() =>
      settingsFromRow({ ...sessionRow, thinkingLevel: null }, house)
    ).toThrow("incomplete LLM settings");
  });
});
