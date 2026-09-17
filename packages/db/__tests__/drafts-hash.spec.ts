import { describe, expect, it } from "vitest";

import { hashFeedDraftSnapshot } from "../src/libs/drafts/hash.ts";
import type { FeedDraftSnapshot } from "../src/schemas/schema.ts";

const empty = {
  title: null,
  excerpt: null,
  description: null,
  summary: null,
  content: null,
};

const full: FeedDraftSnapshot = {
  slug: "hello-world",
  type: "post",
  defaultLocale: "zh-TW",
  mainImage: null,
  translations: {
    "zh-TW": {
      title: "標題 😀",
      excerpt: null,
      description: "",
      summary: "摘要",
      content: '# 內文\n\n「引號」— dash\ttab \\ backslash "q"\n',
    },
    en: { ...empty, title: "Title", content: "body +12:fake -" },
  },
};

describe("hashFeedDraftSnapshot", () => {
  // Expected values come from the SQL backfill in `20260917042320_feed_draft_content_hash`
  // run over the same rows, so a drift between the two implementations fails here.
  it("matches the migration's SQL backfill", () => {
    expect(hashFeedDraftSnapshot(full)).toBe(
      "89f60f2fe0afc0b78f51a789dd4caa849c24d32dbcef9652611f89da0a23ff67"
    );
    expect(
      hashFeedDraftSnapshot({
        slug: null,
        type: "note",
        defaultLocale: "en",
        mainImage: "https://x/y.png",
        translations: { en: { ...empty, title: "Only" } },
      })
    ).toBe("08bfd4c5d19ab8fbe3d92fb714153043a17110b0080f9da7cf8f8d8a0abf992e");
    expect(
      hashFeedDraftSnapshot({
        slug: "",
        type: "post",
        defaultLocale: "en",
        mainImage: null,
        translations: { en: empty },
      })
    ).toBe("741cec1b65f58f95c540820e0523d1fc3b574140dfb3150e4563d26e74268bb9");
  });

  it("ignores the order locales were written in", () => {
    const { en, "zh-TW": zh } = full.translations;
    expect(
      hashFeedDraftSnapshot({ ...full, translations: { "zh-TW": zh, en } })
    ).toBe(hashFeedDraftSnapshot(full));
    expect(
      hashFeedDraftSnapshot({ ...full, translations: { en, "zh-TW": zh } })
    ).toBe(hashFeedDraftSnapshot(full));
  });

  it("tells null from empty and keeps adjacent fields apart", () => {
    const base = { ...full, translations: { en: { ...empty, title: "ab" } } };
    expect(
      hashFeedDraftSnapshot({
        ...base,
        translations: { en: { ...empty, title: "a", excerpt: "b" } },
      })
    ).not.toBe(hashFeedDraftSnapshot(base));
    expect(
      hashFeedDraftSnapshot({
        ...base,
        translations: { en: { ...empty, title: "ab", excerpt: "" } },
      })
    ).not.toBe(hashFeedDraftSnapshot(base));
  });

  it("hashes text as Postgres stores it", () => {
    expect(
      hashFeedDraftSnapshot({
        ...full,
        translations: { en: { ...empty, content: "a\0b\uD800" } },
      })
    ).toBe(
      hashFeedDraftSnapshot({
        ...full,
        translations: { en: { ...empty, content: "ab�" } },
      })
    );
  });
});
