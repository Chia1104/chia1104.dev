import { describe, expect, it } from "vitest";

import { entriesUpToSeq } from "../src/session/entries.ts";
import type { SessionEntry } from "../src/session/entries.ts";

const message = (
  id: string,
  parentId: string | null,
  seq: number
): SessionEntry => ({
  type: "message",
  id,
  parentId,
  seq,
  timestamp: seq,
  message: { role: "user", content: id, timestamp: seq },
});

describe("entriesUpToSeq", () => {
  it("keeps what was persisted up to the cut, whichever branch it sits on", () => {
    // The branch the client is shown: a rewind left `b` behind, the turn appended `d` after `a`.
    const branch = [message("a", null, 1), message("d", "a", 4)];

    expect(entriesUpToSeq(branch, 3).map((entry) => entry.id)).toEqual(["a"]);
    expect(entriesUpToSeq(branch, 0)).toEqual([]);
    expect(entriesUpToSeq(branch, 4)).toHaveLength(2);
  });
});
