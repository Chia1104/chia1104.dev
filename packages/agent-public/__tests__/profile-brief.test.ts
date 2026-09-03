import { describe, expect, it } from "vitest";

import type { ProfileEntrySnapshot } from "@chia/agent-content/types";

import { renderProfileBrief } from "../src/prompts/profile.ts";

const about: ProfileEntrySnapshot = {
  kind: "about",
  data: {
    translations: {
      "zh-TW": { title: "前端工程師", summary: "熱衷於現代網頁技術。" },
      en: { title: "Frontend engineer" },
    },
  },
};

const leadbest: ProfileEntrySnapshot = {
  kind: "experience",
  data: {
    organization: "LeadBest",
    location: "Taipei",
    startDate: "2023-03",
    stack: ["TypeScript", "React"],
    translations: {
      "zh-TW": {
        title: "前端工程師",
        content: "- 開發區塊鏈數據分析平台\n- 開發多鏈錢包",
      },
    },
  },
};

const wanin: ProfileEntrySnapshot = {
  kind: "experience",
  data: {
    organization: "WANIN",
    startDate: "2022-07",
    endDate: "2023-01",
    stack: [],
    translations: {
      en: { title: "Frontend engineer", content: "- Turborepo migration" },
    },
  },
};

const project: ProfileEntrySnapshot = {
  kind: "project",
  data: {
    repository: "https://github.com/Chia1104/chia1104.dev",
    stack: ["Next.js"],
    translations: { en: { title: "chia1104.dev", summary: "This site." } },
  },
};

describe("renderProfileBrief", () => {
  it("renders about first, then sections in a fixed order, falling back across locales", () => {
    const brief = renderProfileBrief([project, wanin, leadbest, about], {
      locale: "zh-TW",
    });
    expect(brief).toBe(
      [
        "### 前端工程師",
        "熱衷於現代網頁技術。",
        "",
        "## Experience",
        "",
        "### Frontend engineer · WANIN (2022-07 – 2023-01)",
        "",
        "- Turborepo migration",
        "",
        "### 前端工程師 · LeadBest (2023-03 – present)",
        "Taipei · Stack: TypeScript, React",
        "",
        "- 開發區塊鏈數據分析平台",
        "- 開發多鏈錢包",
        "",
        "## Projects",
        "",
        "### chia1104.dev",
        "This site.",
        "Source: https://github.com/Chia1104/chia1104.dev · Stack: Next.js",
      ].join("\n")
    );
  });

  it("is null with nothing to say and keeps only the first about entry", () => {
    expect(renderProfileBrief([], { locale: "en" })).toBeNull();
    const twice = renderProfileBrief([about, about], { locale: "en" });
    expect(twice?.match(/### Frontend engineer/g)).toHaveLength(1);
  });

  it("drops bodies from the last entry backwards before cutting text", () => {
    const full = renderProfileBrief([leadbest, wanin], { locale: "en" });
    expect(full).toContain("- Turborepo migration");
    expect(full).toContain("- 開發多鏈錢包");

    const trimmed = renderProfileBrief([leadbest, wanin], {
      locale: "en",
      maxChars: (full?.length ?? 0) - 1,
    });
    expect(trimmed).not.toContain("- Turborepo migration");
    expect(trimmed).toContain("- 開發多鏈錢包");
    expect(trimmed).toContain("### Frontend engineer · WANIN");

    const cut = renderProfileBrief([leadbest, wanin], {
      locale: "en",
      maxChars: 20,
    });
    expect(cut).toHaveLength(20);
  });
});
