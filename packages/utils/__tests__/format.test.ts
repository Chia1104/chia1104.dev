import { describe, expect, it } from "vitest";

import { oneLine, truncateEnd } from "../src/format";

describe("truncateEnd", () => {
  it("leaves text within the limit alone", () => {
    expect(truncateEnd("abc", 3)).toBe("abc");
  });

  it("never exceeds the limit, ellipsis included", () => {
    expect(truncateEnd("abcdef", 4)).toBe("abc…");
    expect(truncateEnd("abcdef", 4)).toHaveLength(4);
  });

  it("returns nothing for a non-positive limit", () => {
    expect(truncateEnd("abc", 0)).toBe("");
    expect(truncateEnd("abc", -1)).toBe("");
  });
});

describe("oneLine", () => {
  it("collapses whitespace before cutting", () => {
    expect(oneLine("  a \n\n b\tc  ", 10)).toBe("a b c");
    expect(oneLine("a b c d e", 4)).toBe("a b…");
  });
});
