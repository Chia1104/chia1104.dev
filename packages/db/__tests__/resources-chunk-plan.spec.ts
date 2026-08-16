import { describe, expect, it } from "vitest";

import { planChunkReplacement } from "../src/libs/resources/chunk.ts";
import type {
  ExistingChunkRow,
  ResourceChunkInput,
} from "../src/libs/resources/chunk.ts";

let nextId = 1;
const row = (
  kind: string,
  chunkIndex: number,
  contentHash: string
): ExistingChunkRow => ({ id: nextId++, kind, chunkIndex, contentHash });

const input = (
  kind: string,
  chunkIndex: number,
  contentHash: string
): ResourceChunkInput => ({
  kind: kind as ResourceChunkInput["kind"],
  chunkIndex,
  content: `content-${contentHash}`,
  contentHash,
});

describe("planChunkReplacement", () => {
  it("keeps an identical chunk set fully unchanged", () => {
    const existing = [
      row("card", 0, "c"),
      row("section", 0, "a"),
      row("section", 1, "b"),
    ];
    const incoming = [
      input("card", 0, "c"),
      input("section", 0, "a"),
      input("section", 1, "b"),
    ];

    const plan = planChunkReplacement(existing, incoming);
    expect(plan.unchanged).toHaveLength(3);
    expect(plan.moved).toHaveLength(0);
    expect(plan.rewritten).toHaveLength(0);
    expect(plan.inserted).toHaveLength(0);
    expect(plan.removed).toHaveLength(0);
  });

  it("recognises an inserted paragraph as one insert plus moves, not a tail rewrite", () => {
    // a new section appears at index 1; every later section shifts by one —
    // under (kind, index) identity the whole tail would have re-embedded
    const existing = [
      row("section", 0, "a"),
      row("section", 1, "b"),
      row("section", 2, "c"),
    ];
    const incoming = [
      input("section", 0, "a"),
      input("section", 1, "new"),
      input("section", 2, "b"),
      input("section", 3, "c"),
    ];

    const plan = planChunkReplacement(existing, incoming);
    expect(plan.unchanged).toHaveLength(1); // "a" stays at 0
    expect(plan.moved.map((m) => m.chunk.contentHash)).toEqual(["b", "c"]);
    expect(plan.inserted.map((c) => c.contentHash)).toEqual(["new"]);
    expect(plan.rewritten).toHaveLength(0);
    expect(plan.removed).toHaveLength(0);
  });

  it("rewrites in place when content changes at a position", () => {
    const existing = [row("section", 0, "a"), row("section", 1, "b")];
    const incoming = [input("section", 0, "a"), input("section", 1, "b2")];

    const plan = planChunkReplacement(existing, incoming);
    expect(plan.unchanged).toHaveLength(1);
    expect(plan.rewritten.map((r) => r.chunk.contentHash)).toEqual(["b2"]);
    expect(plan.moved).toHaveLength(0);
    expect(plan.inserted).toHaveLength(0);
  });

  it("removes rows for a shrunken document and moves the survivors", () => {
    const existing = [
      row("section", 0, "a"),
      row("section", 1, "b"),
      row("section", 2, "c"),
    ];
    const incoming = [input("section", 0, "c")];

    const plan = planChunkReplacement(existing, incoming);
    expect(plan.moved.map((m) => m.chunk.contentHash)).toEqual(["c"]);
    expect(plan.removed).toHaveLength(2);
    expect(plan.unchanged).toHaveLength(0);
  });

  it("claims duplicate hashes one row at a time", () => {
    // the same content appears twice; each incoming duplicate must claim a
    // distinct row, and a third occurrence is an insert
    const existing = [row("section", 0, "dup"), row("section", 1, "dup")];
    const incoming = [
      input("section", 0, "dup"),
      input("section", 1, "dup"),
      input("section", 2, "dup"),
    ];

    const plan = planChunkReplacement(existing, incoming);
    expect(plan.unchanged).toHaveLength(2);
    expect(plan.inserted).toHaveLength(1);
    expect(plan.removed).toHaveLength(0);
  });

  it("does not cross kinds: a card never claims a section's row", () => {
    const existing = [row("section", 0, "same")];
    const incoming = [input("card", 0, "same")];

    const plan = planChunkReplacement(existing, incoming);
    expect(plan.inserted).toHaveLength(1);
    expect(plan.removed).toHaveLength(1);
  });
});
