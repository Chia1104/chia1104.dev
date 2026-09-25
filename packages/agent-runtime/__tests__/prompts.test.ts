import { describe, expect, it } from "vitest";

import { xmlBlock, xmlField } from "../src/prompts.ts";

describe("xmlBlock", () => {
  it("puts the body on its own lines and writes attributes in order", () => {
    expect(xmlBlock("edit", "-a\n+b", { draft: 7, field: "en.content" })).toBe(
      '<edit draft="7" field="en.content">\n-a\n+b\n</edit>'
    );
  });
});

describe("xmlField", () => {
  it("keeps a short value on one line", () => {
    expect(xmlField("title", "標題")).toBe("<title>標題</title>");
  });
});
