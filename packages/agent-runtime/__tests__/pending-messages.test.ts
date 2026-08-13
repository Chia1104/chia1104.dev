import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db";
import {
  claimAgentPendingMessages,
  pushAgentPendingMessage,
  releaseAgentPendingMessages,
} from "@chia/db/repos/agent";

import {
  InMemoryPendingMessageStore,
  PgPendingMessageStore,
} from "../src/session/pg-pending-messages.ts";

vi.mock("@chia/db/repos/agent", () => ({
  claimAgentPendingMessages: vi.fn(),
  peekAgentPendingMessages: vi.fn(),
  pushAgentPendingMessage: vi.fn(),
  releaseAgentPendingMessages: vi.fn(),
}));

const claimMock = vi.mocked(claimAgentPendingMessages);
const pushMock = vi.mocked(pushAgentPendingMessage);
const releaseMock = vi.mocked(releaseAgentPendingMessages);

const db = {} as DB;

describe("PgPendingMessageStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims messages and hands the ids back on release", async () => {
    const store = new PgPendingMessageStore(db);
    claimMock.mockResolvedValue([
      { id: "m1", kind: "steer", text: "wait", createdAt: new Date(0) },
      { id: "m2", kind: "followUp", text: "then this", createdAt: new Date(1) },
    ] as never);

    const claimed = await store.claim("session-1");
    expect(claimed.map((message) => message.id)).toEqual(["m1", "m2"]);

    await store.release(["m2"]);
    expect(releaseMock).toHaveBeenCalledWith(db, ["m2"]);
  });

  it("passes the queue kind straight through on push", async () => {
    const store = new PgPendingMessageStore(db);
    await store.push("session-1", "followUp", "later");

    expect(pushMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        sessionId: "session-1",
        kind: "followUp",
        text: "later",
      })
    );
  });
});

describe("InMemoryPendingMessageStore", () => {
  it("does not re-deliver a claimed message", async () => {
    const store = new InMemoryPendingMessageStore();
    await store.push("session-1", "steer", "first");

    expect((await store.claim("session-1")).map((m) => m.text)).toEqual([
      "first",
    ]);
    expect(await store.claim("session-1")).toEqual([]);
  });

  it("re-delivers a released message, ahead of anything queued since", async () => {
    const store = new InMemoryPendingMessageStore();
    await store.push("session-1", "steer", "first");

    const [claimed] = await store.claim("session-1");
    expect(claimed).toBeDefined();

    await store.push("session-1", "steer", "second");
    await store.release([claimed!.id]);

    // Original order survives: `release` restores position rather than appending.
    expect((await store.claim("session-1")).map((m) => m.text)).toEqual([
      "first",
      "second",
    ]);
  });

  it("keeps sessions isolated", async () => {
    const store = new InMemoryPendingMessageStore();
    await store.push("session-1", "steer", "mine");
    await store.push("session-2", "steer", "theirs");

    expect((await store.claim("session-1")).map((m) => m.text)).toEqual([
      "mine",
    ]);
    expect((await store.peek("session-2")).map((m) => m.text)).toEqual([
      "theirs",
    ]);
  });
});
