import { describe, expect, it } from "vitest";

import { FeedType, Locale } from "@chia/db/types";

import {
  emptyDraft,
  languageMismatch,
  patchFeedMeta,
  patchTranslation,
} from "../src/draft/operations.ts";

describe("patchTranslation", () => {
  it("leaves omitted fields alone but clears explicit nulls", () => {
    let draft = patchTranslation(emptyDraft(), Locale.En, {
      title: "Original",
      excerpt: "An excerpt",
      description: "A description",
    });

    // The model routinely sends only the field it is changing.
    draft = patchTranslation(draft, Locale.En, { title: "Updated" });
    expect(draft.translations.en).toMatchObject({
      title: "Updated",
      excerpt: "An excerpt",
      description: "A description",
    });

    // `null` is the explicit "clear this" signal, and must not be confused with "omitted".
    draft = patchTranslation(draft, Locale.En, { excerpt: null });
    expect(draft.translations.en?.excerpt).toBeNull();
    expect(draft.translations.en?.description).toBe("A description");
  });

  it("keeps locales independent", () => {
    let draft = patchTranslation(emptyDraft(), Locale.En, { title: "English" });
    draft = patchTranslation(draft, Locale.ZhTW, { title: "中文" });
    expect(draft.translations.en?.title).toBe("English");
    expect(draft.translations[Locale.ZhTW]?.title).toBe("中文");
  });
});

describe("patchFeedMeta", () => {
  it("merges without dropping previously set fields", () => {
    let draft = patchFeedMeta(emptyDraft(), {
      slug: "a-post",
      type: FeedType.Post,
    });
    draft = patchFeedMeta(draft, {
      defaultLocale: Locale.En,
      slug: undefined,
    });
    expect(draft).toMatchObject({
      slug: "a-post",
      type: FeedType.Post,
      defaultLocale: Locale.En,
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
    expect(languageMismatch(Locale.En, chinese)).toMatch(
      /en locale takes English prose/
    );
    expect(languageMismatch(Locale.ZhTW, english)).toMatch(
      /zh-TW locale takes Chinese prose/
    );
    expect(languageMismatch(Locale.En, english)).toBeUndefined();
    expect(languageMismatch(Locale.ZhTW, chinese)).toBeUndefined();
  });

  it("ignores code, tolerates English terms in Chinese prose and does not judge a short body", () => {
    expect(
      languageMismatch(
        Locale.En,
        `${english}\n\n\`\`\`ts\n// ${chinese}\n\`\`\``
      )
    ).toBeUndefined();
    expect(
      languageMismatch(
        Locale.ZhTW,
        "我們用 `pgvector` 的 HNSW index 做 hybrid search，再用 BM25 補召回。".repeat(
          3
        )
      )
    ).toBeUndefined();
    expect(languageMismatch(Locale.En, "短")).toBeUndefined();
  });

  it("reads tilde fences and nested fences as code", () => {
    expect(
      languageMismatch(Locale.En, `${english}\n\n~~~\n${chinese}\n~~~`)
    ).toBeUndefined();
    expect(
      languageMismatch(
        Locale.En,
        `${english}\n\n\`\`\`\`md\n\`\`\`ts\n${chinese}\n\`\`\`\n${chinese}\n\`\`\`\``
      )
    ).toBeUndefined();
  });
});
