import { describe, expect, it } from "vitest";

import { WWW_BASE_URL, feedPath, feedUrl } from "./index";

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

  it("serves hobby writing in the hobby mode's URL space", () => {
    expect(feedUrl({ type: "guide", slug: "runes", locale: "en" })).toBe(
      `${WWW_BASE_URL}/en-US/hobby/guides/runes`
    );
  });
});

describe("feedPath", () => {
  it.each([
    ["post", "/posts/hello"],
    ["note", "/notes/hello"],
    ["guide", "/hobby/guides/hello"],
    ["review", "/hobby/reviews/hello"],
    ["journal", "/hobby/journal/hello"],
  ])("places a %s at %s", (type, path) => {
    expect(feedPath({ type, slug: "hello" })).toBe(path);
  });
});
