import { describe, expect, it } from "vitest";

import { rebaseValues, toWrite } from "../src/components/feed/draft-values";
import type { DraftValues } from "../src/components/feed/draft-values";

const translation = (title: string | null, content: string | null) => ({
  title,
  excerpt: null,
  description: null,
  content,
});

const base: DraftValues = {
  slug: "a-post",
  type: "post",
  defaultLocale: "zh-TW",
  mainImage: null,
  translations: {
    "zh-TW": translation("標題", "# 標題\n\n第一段\n\n第二段\n"),
    en: translation(null, null),
  },
};

const withBody = (
  values: DraftValues,
  locale: "zh-TW" | "en",
  content: string
) => ({
  ...values,
  translations: {
    ...values.translations,
    [locale]: { ...values.translations[locale]!, content },
  },
});

describe("toWrite", () => {
  it("is null when nothing moved", () => {
    expect(toWrite(base, structuredClone(base))).toBeNull();
  });

  it("sends each value with the one it replaces", () => {
    const local: DraftValues = {
      ...base,
      slug: "renamed",
      translations: {
        ...base.translations,
        en: translation("Title", "A first body"),
      },
    };
    expect(toWrite(local, base)).toEqual({
      slug: "renamed",
      translations: { en: { title: "Title", content: "A first body" } },
      base: {
        slug: "a-post",
        translations: { en: { title: null, content: null } },
      },
    });
  });

  it("sends a body that had text as edits, not as a value", () => {
    const write = toWrite(
      withBody(base, "zh-TW", "# 標題\n\n第一段\n\n第二段，補充\n"),
      base
    );
    expect(write?.translations).toBeUndefined();
    expect(write?.base).toBeUndefined();
    expect(write?.edits?.["zh-TW"]).toHaveLength(1);
  });
});

describe("rebaseValues", () => {
  it("takes what the agent wrote in another locale and keeps what was typed here", () => {
    const local = withBody(
      base,
      "zh-TW",
      "# 標題\n\n第一段，我改的\n\n第二段\n"
    );
    const next: DraftValues = {
      ...base,
      translations: {
        ...base.translations,
        en: translation("Title", "Translated body"),
      },
    };
    const { values, conflicts } = rebaseValues({ base, local, next });
    expect(conflicts).toEqual([]);
    expect(values.translations.en).toEqual(
      translation("Title", "Translated body")
    );
    expect(values.translations["zh-TW"]?.content).toBe(
      "# 標題\n\n第一段，我改的\n\n第二段\n"
    );
  });

  it("merges two changes to different paragraphs of one body", () => {
    const local = withBody(
      base,
      "zh-TW",
      "# 標題\n\n第一段，我改的\n\n第二段\n"
    );
    const next = withBody(
      base,
      "zh-TW",
      "# 標題\n\n第一段\n\n第二段，agent 改的\n"
    );
    const { values, conflicts } = rebaseValues({ base, local, next });
    expect(conflicts).toEqual([]);
    expect(values.translations["zh-TW"]?.content).toBe(
      "# 標題\n\n第一段，我改的\n\n第二段，agent 改的\n"
    );
  });

  it("keeps the local text and reports a body both sides changed in one place", () => {
    const local = withBody(
      base,
      "zh-TW",
      "# 標題\n\n第一段，我改的\n\n第二段\n"
    );
    const next = withBody(
      base,
      "zh-TW",
      "# 標題\n\n第一段，agent 改的\n\n第二段\n"
    );
    const { values, conflicts } = rebaseValues({ base, local, next });
    expect(conflicts).toEqual([{ locale: "zh-TW", field: "content" }]);
    expect(values.translations["zh-TW"]?.content).toBe(
      local.translations["zh-TW"]?.content
    );
  });

  it("reports a field both sides set differently, and not one they set alike", () => {
    expect(
      rebaseValues({
        base,
        local: { ...base, slug: "mine" },
        next: { ...base, slug: "theirs" },
      }).conflicts
    ).toEqual([{ field: "slug" }]);
    expect(
      rebaseValues({
        base,
        local: { ...base, slug: "same" },
        next: { ...base, slug: "same" },
      }).conflicts
    ).toEqual([]);
  });

  it("lets later typing win over the stored form of what was just saved", () => {
    // Sent "My Slug", the server stored "my-slug", and the operator kept typing meanwhile.
    const sent = { ...base, slug: "My Slug" };
    const { values, conflicts } = rebaseValues({
      base: sent,
      local: { ...base, slug: "My Slug 2" },
      next: { ...base, slug: "my-slug" },
      acknowledged: true,
    });
    expect(conflicts).toEqual([]);
    expect(values.slug).toBe("My Slug 2");
    expect(
      rebaseValues({
        base: sent,
        local: sent,
        next: { ...base, slug: "my-slug" },
        acknowledged: true,
      }).values.slug
    ).toBe("my-slug");
  });
});
