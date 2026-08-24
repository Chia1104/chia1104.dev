import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import {
  appendAgentSessionEntry,
  createAgentSession,
  getAgentSession,
  getAgentSessionEntries,
  getAgentSessionEntry,
} from "@chia/db/repos/agent";

import { PgSessionRepo } from "../src/session/pg-repo.ts";

vi.mock("@chia/db/repos/agent", () => ({
  appendAgentSessionEntry: vi.fn(),
  createAgentSession: vi.fn(),
  getAgentSession: vi.fn(),
  getAgentSessions: vi.fn(),
  getAgentSessionEntries: vi.fn(),
  getAgentSessionEntriesByType: vi.fn(),
  getAgentSessionEntry: vi.fn(),
  softDeleteAgentSession: vi.fn(),
  updateAgentSession: vi.fn(),
}));

const db =
  /* SAFETY: This fixture implements the DB members exercised by this case. */ {} as DB;

const sessionRow = {
  id: "session-1",
  kind: "writing",
  userId: "user-1",
  title: "Original",
  createdAt: new Date("2026-07-27T00:00:00.000Z"),
  providerId: "faux",
  modelId: "test-model",
  thinkingLevel: "off",
  activeToolNames: null,
  autoApprove: [],
  leafEntryId: "a2",
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
    vi.mocked(getAgentSession).mockResolvedValue(
      /* SAFETY: This fixture implements the session row members exercised by this case. */ sessionRow as never
    );
    vi.mocked(getAgentSessionEntries).mockResolvedValue(
      /* SAFETY: These rows implement the repository shape exercised by this case. */ rows as never
    );
    vi.mocked(getAgentSessionEntry).mockImplementation(
      async (_db, _sessionId, id) =>
        /* SAFETY: These rows implement the repository shape exercised by this case. */ rows.find(
          (candidate) => candidate.id === id
        ) as never
    );
  });

  const repo = () =>
    new PgSessionRepo(db, {
      kind: "writing",
      defaults: { providerId: "faux", modelId: "test-model" },
    });

  it("copies the branch below a user message so it can be re-asked", async () => {
    const forked = await repo().fork(
      { id: "session-1" },
      { id: "fork-1", entryId: "u2", position: "before" }
    );

    expect(forked.id).toBe("fork-1");
    expect(vi.mocked(createAgentSession)).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        id: "fork-1",
        userId: "user-1",
        title: "Original",
      })
    );
    expect(
      vi
        .mocked(appendAgentSessionEntry)
        .mock.calls.map(([, input]) => [input.id, input.sessionId])
    ).toEqual([
      ["u1", "fork-1"],
      ["a1", "fork-1"],
    ]);
  });

  it("copies through the target when forking at it", async () => {
    await repo().fork(
      { id: "session-1" },
      { id: "fork-1", entryId: "a1", position: "at" }
    );

    expect(
      vi.mocked(appendAgentSessionEntry).mock.calls.map(([, input]) => input.id)
    ).toEqual(["u1", "a1"]);
  });

  it("refuses to fork before an assistant message", async () => {
    await expect(
      repo().fork({ id: "session-1" }, { entryId: "a1", position: "before" })
    ).rejects.toThrow("is not a user message");
  });

  it("copies every entry when no target is given", async () => {
    await repo().fork({ id: "session-1" }, { id: "fork-1" });

    expect(
      vi.mocked(appendAgentSessionEntry).mock.calls.map(([, input]) => input.id)
    ).toEqual(["u1", "a1", "u2", "a2"]);
  });
});
