import { describe, expect, it } from "vitest";

import { hashFeedDraftSnapshot } from "../src/libs/drafts/hash.ts";
import type { FeedDraftSnapshot } from "../src/schemas/schema.ts";

const empty = {
  title: null,
  excerpt: null,
  description: null,
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
      content: '# 內文\n\n「引號」— dash\ttab \\ backslash "q"\n',
    },
    en: { ...empty, title: "Title", content: "body +12:fake -" },
  },
};

describe("hashFeedDraftSnapshot", () => {
  // Expected values come from the SQL rehash in `20260923093845_feed_summary_workflow_owned`
  // run over the same rows, so a drift between the two implementations fails here.
  it("matches the migration's SQL backfill", () => {
    expect(hashFeedDraftSnapshot(full)).toBe(
      "efc084268468120ba62c2c36d57e0311f17f7da3fe5a69fc6e14b5912db08ce2"
    );
    expect(
      hashFeedDraftSnapshot({
        slug: null,
        type: "note",
        defaultLocale: "en",
        mainImage: "https://x/y.png",
        translations: { en: { ...empty, title: "Only" } },
      })
    ).toBe("17c2b3feb294bcf701a2ff7273363c0d465d0f8033ae146b0bf7fa515d984f1f");
    expect(
      hashFeedDraftSnapshot({
        slug: "",
        type: "post",
        defaultLocale: "en",
        mainImage: null,
        translations: { en: empty },
      })
    ).toBe("42dde9109daf8c43782402dafe97280e6a27598fee1a316d5005b86cb0931fb1");
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
