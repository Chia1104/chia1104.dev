import { describe, expect, it } from "vitest";

import { profileEntryContentSchema } from "../src/libs/validator/profile.ts";

const experience = {
  kind: "experience",
  data: {
    organization: "LeadBest",
    url: "https://www.leadbestconsultant.com/",
    startDate: "2023-03-01",
    stack: ["TypeScript", "React"],
    translations: {
      "zh-TW": { title: "前端工程師", content: "- 開發區塊鏈數據分析平台" },
    },
  },
} as const;

describe("profileEntryContentSchema", () => {
  it("accepts an ongoing experience with one locale and trims prose", () => {
    const parsed = profileEntryContentSchema.parse({
      ...experience,
      data: {
        ...experience.data,
        translations: { "zh-TW": { title: "  前端工程師  " } },
      },
    });
    expect(parsed.kind).toBe("experience");
    if (parsed.kind !== "experience") return;
    expect(parsed.data.translations["zh-TW"]?.title).toBe("前端工程師");
    expect(parsed.data.endDate).toBeUndefined();
  });

  it("rejects an entry without any locale", () => {
    const result = profileEntryContentSchema.safeParse({
      ...experience,
      data: { ...experience.data, translations: {} },
    });
    expect(result.success).toBe(false);
  });

  it("rejects dates that are not YYYY-MM-DD or that end before they start", () => {
    expect(
      profileEntryContentSchema.safeParse({
        ...experience,
        data: { ...experience.data, startDate: "2023-03" },
      }).success
    ).toBe(false);
    expect(
      profileEntryContentSchema.safeParse({
        ...experience,
        data: {
          ...experience.data,
          startDate: "2023-03-01",
          endDate: "2022-12-31",
        },
      }).success
    ).toBe(false);
  });

  it("keeps the data shape of one kind out of another", () => {
    const result = profileEntryContentSchema.safeParse({
      kind: "about",
      data: experience.data,
    });
    // `about` is a strip-by-default object: unknown keys drop, translations survive
    expect(result.success).toBe(true);
    expect(result.data?.data).toEqual({
      translations: experience.data.translations,
    });
  });

  it("defaults a project's stack to an empty list", () => {
    const parsed = profileEntryContentSchema.parse({
      kind: "project",
      data: {
        repository: "https://github.com/Chia1104/chia1104.dev",
        translations: { en: { title: "chia1104.dev" } },
      },
    });
    if (parsed.kind !== "project") throw new Error("kind mismatch");
    expect(parsed.data.stack).toEqual([]);
  });
});
