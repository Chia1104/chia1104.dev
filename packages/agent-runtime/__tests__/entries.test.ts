import { describe, expect, it } from "vitest";

import { entriesUpToSeq } from "../src/session/entries.ts";
import type { SessionEntry } from "../src/session/entries.ts";

const label = (
  id: string,
  parentId: string | null,
  seq: number
): SessionEntry => ({
  type: "label",
  id,
  parentId,
  seq,
  timestamp: seq,
  targetId: id,
  label: id,
});

describe("entriesUpToSeq", () => {
  it("keeps what was persisted up to the cut, whichever branch it sits on", () => {
    // The branch the client is shown: a rewind left `b` behind, the turn appended `d` after `a`.
    const branch = [label("a", null, 1), label("d", "a", 4)];

    expect(entriesUpToSeq(branch, 3).map((entry) => entry.id)).toEqual(["a"]);
    expect(entriesUpToSeq(branch, 0)).toEqual([]);
    expect(entriesUpToSeq(branch, 4)).toHaveLength(2);
  });
});
