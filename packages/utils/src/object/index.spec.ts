import { describe, expect, it } from "vitest";

import { mergeDefined, omitUndefined } from "./index.ts";

describe("omitUndefined", () => {
  it("drops undefined properties and preserves explicit nulls", () => {
    expect(
      omitUndefined({ kept: "value", cleared: null, omitted: undefined })
    ).toEqual({ kept: "value", cleared: null });
  });
});

describe("mergeDefined", () => {
  it("leaves undefined fields unchanged and applies explicit values", () => {
    expect(
      mergeDefined(
        { title: "Original", excerpt: "Keep", published: false },
        { title: "Updated", excerpt: undefined, published: true }
      )
    ).toEqual({ title: "Updated", excerpt: "Keep", published: true });
  });
});
