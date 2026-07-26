import { describe, expect, it } from "vitest";

import {
  applyEdit,
  EditNotAppliedError,
  emptyDraft,
  patchFeedMeta,
  patchTranslation,
  withLineNumbers,
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
    draft = patchFeedMeta(draft, { defaultLocale: "en" });
    expect(draft.feedMeta).toEqual({
      slug: "a-post",
      type: "post",
      defaultLocale: "en",
    });
  });
});

describe("applyEdit", () => {
  const body = "## Title\n\nFirst paragraph.\n\nSecond paragraph.";

  it("replaces a unique match", () => {
    const result = applyEdit(body, "First paragraph.", "Rewritten.");
    expect(result.content).toContain("Rewritten.");
    expect(result.replacements).toBe(1);
  });

  it("refuses an ambiguous match rather than guessing", () => {
    const repeated = "same line\nsame line";
    expect(() => applyEdit(repeated, "same line", "changed")).toThrow(
      EditNotAppliedError
    );
    // The error must say how to proceed, since it is fed straight back to the model.
    expect(() => applyEdit(repeated, "same line", "changed")).toThrow(
      /matches 2 places/
    );
  });

  it("replaces every occurrence when asked", () => {
    const repeated = "same line\nsame line";
    const result = applyEdit(repeated, "same line", "changed", true);
    expect(result.content).toBe("changed\nchanged");
    expect(result.replacements).toBe(2);
  });

  it("reports a miss instead of silently doing nothing", () => {
    expect(() => applyEdit(body, "does not exist", "x")).toThrow(
      /was not found/
    );
  });

  it("rejects an empty target", () => {
    expect(() => applyEdit(body, "", "x")).toThrow(/must not be empty/);
  });

  it("deletes when the replacement is empty", () => {
    const result = applyEdit(body, "\n\nSecond paragraph.", "");
    expect(result.content).toBe("## Title\n\nFirst paragraph.");
  });
});

describe("withLineNumbers", () => {
  it("right-aligns numbers so the body stays readable past line 9", () => {
    const numbered = withLineNumbers(
      Array.from({ length: 10 }, (_, index) => `line ${index + 1}`).join("\n")
    );
    const lines = numbered.split("\n");
    expect(lines[0]).toBe(" 1\tline 1");
    expect(lines[9]).toBe("10\tline 10");
  });
});
