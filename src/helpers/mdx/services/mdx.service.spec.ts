import { getEncodedSlugs } from "./mdx.service";
import { describe, expect, it } from "vitest";

describe("getEncodedSlugs", () => {
  it("should return an array of encoded slugs", async () => {
    const slugs = await getEncodedSlugs();
    expect(slugs).toEqual(["example%20post%202", "example-post"]);
  });
});
