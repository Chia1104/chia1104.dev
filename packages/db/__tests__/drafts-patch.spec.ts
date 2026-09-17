import { describe, expect, it } from "vitest";

import { settleFeedDraftPatch } from "../src/libs/drafts/patch.ts";
import type { FeedDraftSnapshot } from "../src/schemas/schema.ts";

const translation = (title: string, content: string | null) => ({
  title,
  excerpt: null,
  description: null,
  summary: null,
  content,
});

const current: FeedDraftSnapshot = {
  slug: "a-post",
  type: "post",
  defaultLocale: "zh-TW",
  mainImage: null,
  translations: {
    "zh-TW": translation("標題", "第一段\n\n第二段\n"),
    en: translation("Title", "One\n\nTwo\n"),
  },
};

describe("settleFeedDraftPatch", () => {
  it("writes a field that still holds its base, beside one another writer changed", () => {
    // The operator edits zh-TW while the agent has just rewritten en.
    expect(
      settleFeedDraftPatch(current, {
        translations: { "zh-TW": { title: "新標題" } },
        base: { translations: { "zh-TW": { title: "標題" } } },
      })
    ).toEqual({
      ok: true,
      fields: { meta: {}, translations: { "zh-TW": { title: "新標題" } } },
    });
  });

  it("rejects the whole write when one field moved off its base", () => {
    expect(
      settleFeedDraftPatch(current, {
        meta: { slug: "renamed" },
        translations: { en: { title: "Mine" } },
        base: {
          meta: { slug: "a-post" },
          translations: { en: { title: "What I saw" } },
        },
      })
    ).toEqual({
      ok: false,
      rejected: [{ locale: "en", field: "title", reason: "changed" }],
    });
  });

  it("leaves alone a field that already holds the new value, whatever its base", () => {
    expect(
      settleFeedDraftPatch(current, {
        meta: { slug: "a-post" },
        translations: { en: { title: "Title" } },
        base: { meta: { slug: "stale" }, translations: { en: { title: "x" } } },
      })
    ).toEqual({ ok: true, fields: { meta: {}, translations: {} } });
  });

  it("reads a locale the draft does not have as all null", () => {
    const { en: _en, ...onlyChinese } = current.translations;
    const draft = { ...current, translations: onlyChinese };
    expect(
      settleFeedDraftPatch(draft, {
        translations: { en: { title: "Title" } },
        base: { translations: { en: { title: null } } },
      })
    ).toMatchObject({ ok: true });
  });

  it("writes over whatever is current when a field has no base", () => {
    expect(
      settleFeedDraftPatch(current, { meta: { mainImage: "https://x/y.png" } })
    ).toEqual({
      ok: true,
      fields: { meta: { mainImage: "https://x/y.png" }, translations: {} },
    });
  });

  it("places body edits byte for byte, and rejects ones whose target is gone", () => {
    expect(
      settleFeedDraftPatch(current, {
        edits: {
          "zh-TW": [{ oldString: "第二段", newString: "第二段，補充" }],
        },
      })
    ).toEqual({
      ok: true,
      fields: {
        meta: {},
        translations: { "zh-TW": { content: "第一段\n\n第二段，補充\n" } },
      },
    });
    expect(
      settleFeedDraftPatch(current, {
        edits: { en: [{ oldString: "Three", newString: "3" }] },
      })
    ).toEqual({
      ok: false,
      rejected: [{ locale: "en", field: "content", reason: "not_found" }],
    });
    expect(
      settleFeedDraftPatch(
        { ...current, translations: { en: translation("Title", null) } },
        { edits: { en: [{ oldString: "One", newString: "1" }] } }
      )
    ).toEqual({
      ok: false,
      rejected: [{ locale: "en", field: "content", reason: "no_body" }],
    });
  });
});
