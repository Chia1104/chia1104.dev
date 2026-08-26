import { fauxAssistantMessage } from "@earendil-works/pi-ai/providers/faux";
import { describe, expect, it } from "vitest";

import { buildBranchContext } from "../src/session/context.ts";
import type { SessionEntry } from "../src/session/entries.ts";
import { InMemorySessionTree } from "../src/session/tree.ts";

/**
 * The projection is what the provider sees, and the provider's cached prefix survives only if the
 * next turn's projection starts with exactly the bytes the previous turn sent. These pin that the
 * projection is a pure function of the branch, so persistence never drifts from what was sent.
 */

// Fixtures carry a seq so they can stand in a branch literal; the in-memory tree assigns its own.
let seq = 0;

const user = (
  id: string,
  parentId: string | null,
  text: string
): SessionEntry => ({
  type: "message",
  id,
  parentId,
  seq: ++seq,
  timestamp: 1,
  message: { role: "user", content: [{ type: "text", text }], timestamp: 1 },
});

const assistant = (
  id: string,
  parentId: string | null,
  text: string
): SessionEntry => ({
  type: "message",
  id,
  parentId,
  seq: ++seq,
  timestamp: 2,
  message: fauxAssistantMessage(text, { timestamp: 2 }),
});

const serialize = (entries: readonly SessionEntry[]) =>
  JSON.stringify(buildBranchContext(entries).messages);

describe("buildBranchContext", () => {
  it("is deterministic for the same branch", () => {
    const branch = [user("u1", null, "Hi"), assistant("a1", "u1", "Hello")];
    expect(serialize(branch)).toBe(serialize(branch));
  });

  it("extends the previous projection byte for byte when a turn appends", async () => {
    const session = new InMemorySessionTree("s");
    await session.appendEntry(user("u1", null, "Hi"));
    await session.appendEntry(assistant("a1", "u1", "Hello"));
    const before = buildBranchContext(await session.getBranch()).messages;

    await session.appendEntry(user("u2", "a1", "More"));
    await session.appendEntry(assistant("a2", "u2", "Sure"));
    const after = buildBranchContext(await session.getBranch()).messages;

    expect(JSON.stringify(after.slice(0, before.length))).toBe(
      JSON.stringify(before)
    );
    expect(after).toHaveLength(before.length + 2);
  });

  it("ignores labels and rows of retired entry types", () => {
    const branch: SessionEntry[] = [
      user("u1", null, "Hi"),
      {
        type: "label",
        id: "l1",
        parentId: "u1",
        seq: ++seq,
        timestamp: 3,
        targetId: "u1",
        label: "start",
      },
      /* SAFETY: A row written by an earlier Pi release that this runtime no longer models. */ {
        type: "session_info",
        id: "s1",
        parentId: "l1",
        seq: ++seq,
        timestamp: 4,
        name: "old",
      } as never,
      assistant("a1", "s1", "Hello"),
    ];

    expect(buildBranchContext(branch).messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
    ]);
  });

  it("projects a compaction as its summary plus the retained tail, dropping what came before", () => {
    const retained = fauxAssistantMessage("Recent answer", { timestamp: 5 });
    const branch: SessionEntry[] = [
      user("u1", null, "Long ago"),
      assistant("a1", "u1", "Forgotten"),
      {
        type: "compaction",
        id: "c1",
        parentId: "a1",
        seq: ++seq,
        timestamp: 6,
        summary: "Everything so far.",
        tokensBefore: 90_000,
        retainedTail: [retained],
      },
      user("u2", "c1", "After"),
    ];

    const messages = buildBranchContext(branch).messages;

    expect(JSON.stringify(messages)).toContain("Everything so far.");
    expect(JSON.stringify(messages)).not.toContain("Forgotten");
    // Pi projects the summary as its own message role ahead of the retained tail.
    expect(messages.map((m) => m.role)).toEqual([
      "compactionSummary",
      "assistant",
      "user",
    ]);
  });
});
