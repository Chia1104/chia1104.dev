import { describe, expect, it } from "vitest";

import type { SessionEntry } from "../src/session/entries.ts";
import { walkBranch, walkTranscript } from "../src/session/tree.ts";

let seq = 0;
const message = (id: string, parentId: string | null): SessionEntry => {
  seq += 1;
  return {
    type: "message",
    id,
    parentId,
    seq,
    timestamp: seq,
    message: { role: "user", content: id, timestamp: seq },
  };
};
const compaction = (id: string, parentId: string): SessionEntry => {
  seq += 1;
  return {
    type: "compaction",
    id,
    parentId,
    seq,
    timestamp: seq,
    summary: "Condensed.",
    tokensBefore: 50_000,
    retainedTail: [],
    fromHook: false,
  };
};

/** u1 → a1 → c1 → u2, with a2 on an abandoned branch under a1. */
const entries = [
  message("u1", null),
  message("a1", "u1"),
  message("a2", "a1"),
  compaction("c1", "a1"),
  message("u2", "c1"),
];

describe("walkBranch", () => {
  it("stops at the newest compaction, which stands in for what lies behind it", () => {
    expect(walkBranch(entries, "u2").map((e) => e.id)).toEqual(["c1", "u2"]);
  });

  it("is empty without a leaf", () => {
    expect(walkBranch(entries, null)).toEqual([]);
  });
});

describe("walkTranscript", () => {
  it("runs through the compaction to the root, leaving the other branch out", () => {
    expect(walkTranscript(entries, "u2").map((e) => e.id)).toEqual([
      "u1",
      "a1",
      "c1",
      "u2",
    ]);
  });

  it("agrees with the branch when nothing was compacted", () => {
    expect(walkTranscript(entries, "a2")).toEqual(walkBranch(entries, "a2"));
  });

  it("stops at a missing parent rather than hanging", () => {
    const orphaned = [message("x", "gone"), message("y", "x")];
    expect(walkTranscript(orphaned, "y").map((e) => e.id)).toEqual(["x", "y"]);
  });
});
