import { describe, expect, it } from "vitest";

import {
  emptyDraft,
  languageMismatch,
  patchFeedMeta,
  patchTranslation,
} from "../src/draft/operations.ts";

describe("patchTranslation", () => {
  it("leaves omitted fields alone but clears explicit nulls", () => {
    let draft = patchTranslation(emptyDraft(), "en", {
      title: "Original",
      excerpt: "An excerpt",
      description: "A description",
    });

    // The model routinely sends only the field it is changing.
    draft = patchTranslation(draft, "en", { title: "Updated" });
    expect(draft.translations.en).toMatchObject({
      title: "Updated",
      excerpt: "An excerpt",
      description: "A description",
    });

    // `null` is the explicit "clear this" signal, and must not be confused with "omitted".
    draft = patchTranslation(draft, "en", { excerpt: null });
    expect(draft.translations.en?.excerpt).toBeNull();
    expect(draft.translations.en?.description).toBe("A description");
  });

  it("keeps locales independent", () => {
    let draft = patchTranslation(emptyDraft(), "en", { title: "English" });
    draft = patchTranslation(draft, "zh-TW", { title: "中文" });
    expect(draft.translations.en?.title).toBe("English");
    expect(draft.translations["zh-TW"]?.title).toBe("中文");
  });
});

describe("patchFeedMeta", () => {
  it("merges without dropping previously set fields", () => {
    let draft = patchFeedMeta(emptyDraft(), { slug: "a-post", type: "post" });
    draft = patchFeedMeta(draft, { defaultLocale: "en", slug: undefined });
    expect(draft).toMatchObject({
      slug: "a-post",
      type: "post",
      defaultLocale: "en",
    });
  });
});

describe("languageMismatch", () => {
  const english =
    "This paragraph explains how the index is built and why the planner picks it over a scan. ".repeat(
      3
    );
  const chinese =
    "這一段說明索引是怎麼建立的，以及規劃器為什麼會選擇它而不是全表掃描。".repeat(
      4
    );

  it("refuses a Chinese body under en and an English body under zh-TW", () => {
    expect(languageMismatch("en", chinese)).toMatch(
      /en locale takes English prose/
    );
    expect(languageMismatch("zh-TW", english)).toMatch(
      /zh-TW locale takes Chinese prose/
    );
    expect(languageMismatch("en", english)).toBeUndefined();
    expect(languageMismatch("zh-TW", chinese)).toBeUndefined();
  });

  it("ignores code, tolerates English terms in Chinese prose and does not judge a short body", () => {
    expect(
      languageMismatch("en", `${english}\n\n\`\`\`ts\n// ${chinese}\n\`\`\``)
    ).toBeUndefined();
    expect(
      languageMismatch(
        "zh-TW",
        "我們用 `pgvector` 的 HNSW index 做 hybrid search，再用 BM25 補召回。".repeat(
          3
        )
      )
    ).toBeUndefined();
    expect(languageMismatch("en", "短")).toBeUndefined();
  });
});
