import { describe, expect, it } from "vitest";

import { WWW_BASE_URL, feedUrl } from "./index";

describe("feedUrl", () => {
  it("serves the default locale without a prefix", () => {
    expect(feedUrl({ type: "post", slug: "hello", locale: "zh-TW" })).toBe(
      `${WWW_BASE_URL}/posts/hello`
    );
  });

  it("serves en under /en-US", () => {
    expect(feedUrl({ type: "note", slug: "hello", locale: "en" })).toBe(
      `${WWW_BASE_URL}/en-US/notes/hello`
    );
  });
});
