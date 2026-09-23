import { describe, expect, it } from "vitest";

import { tagWriteSchema } from "../src/libs/validator/tags.ts";

const write = {
  slug: "typescript",
  translations: {
    "zh-TW": { name: "TypeScript", description: "  " },
    en: { name: " TypeScript ", description: "Typed JavaScript" },
  },
};

describe("tagWriteSchema", () => {
  it("trims names and stores a blank description as null", () => {
    const parsed = tagWriteSchema.parse(write);
    expect(parsed.translations.en.name).toBe("TypeScript");
    expect(parsed.translations["zh-TW"].description).toBeNull();
    expect(parsed.translations.en.description).toBe("Typed JavaScript");
  });

  it("accepts an omitted description", () => {
    const parsed = tagWriteSchema.parse({
      ...write,
      translations: { "zh-TW": { name: "前端" }, en: { name: "Frontend" } },
    });
    expect(parsed.translations.en.description).toBeNull();
  });

  it("requires a name in both locales", () => {
    expect(
      tagWriteSchema.safeParse({
        ...write,
        translations: { en: { name: "TypeScript" } },
      }).success
    ).toBe(false);
    expect(
      tagWriteSchema.safeParse({
        ...write,
        translations: { ...write.translations, en: { name: "  " } },
      }).success
    ).toBe(false);
  });

  it.each(["TypeScript", "type script", "-typescript", "type--script", "前端"])(
    "rejects slug %j",
    (slug) => {
      expect(tagWriteSchema.safeParse({ ...write, slug }).success).toBe(false);
    }
  );

  it("accepts a hyphenated ASCII slug", () => {
    expect(tagWriteSchema.parse({ ...write, slug: "next-js-16" }).slug).toBe(
      "next-js-16"
    );
  });
});
