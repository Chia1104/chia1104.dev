import { describe, expect, it } from "vitest";
import { name } from "../src";

describe("mdx test", () => {
  it("returns mdx", () => {
    expect(name).toEqual("mdx");
  });
});
