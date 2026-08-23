import { describe, expect, it } from "vitest";

import {
  filterSlashMenuItems,
  findSlashCommand,
  formatSlashCommand,
  parseSlashCommand,
  removeSlashToken,
  replaceSlashToken,
  slashTokenAt,
} from "../src/slash-command.ts";
import type { SlashMenuItem } from "../src/slash-command.ts";

describe("slashTokenAt", () => {
  it("finds the slash token at the caret anywhere after whitespace", () => {
    expect(slashTokenAt("Draft this with /SEO later", 20)).toEqual({
      start: 16,
      end: 20,
      query: "seo",
    });
    expect(slashTokenAt("/NEW", 4)).toEqual({
      start: 0,
      end: 4,
      query: "new",
    });
    expect(slashTokenAt("請使用/seo", 7)).toEqual({
      start: 3,
      end: 7,
      query: "seo",
    });
  });

  it("does not activate inside URLs or after the caret leaves the token", () => {
    expect(slashTokenAt("read https://example.com/x", 13)).toBeNull();
    expect(slashTokenAt("use /seo later", 9)).toBeNull();
  });
});

describe("slash token edits", () => {
  it("replaces only the active token and preserves surrounding prose", () => {
    const text = "Please use /seo before publishing";
    const token = slashTokenAt(text, 15)!;
    expect(replaceSlashToken(text, token, "skill:seo-metadata ")).toEqual({
      text: "Please use skill:seo-metadata before publishing",
      cursor: 30,
    });

    const cjkText = "請使用/seo完成";
    const cjkToken = slashTokenAt(cjkText, 7)!;
    expect(replaceSlashToken(cjkText, cjkToken, "/seo-pass ")).toEqual({
      text: "請使用/seo-pass 完成",
      cursor: 13,
    });
  });

  it("removes a local command without leaving doubled whitespace", () => {
    const text = "Please /model continue";
    const token = slashTokenAt(text, 13)!;
    expect(removeSlashToken(text, token)).toEqual({
      text: "Please continue",
      cursor: 7,
    });
  });
});

describe("parseSlashCommand", () => {
  it("tokenizes quoted and escaped arguments", () => {
    expect(
      parseSlashCommand('/rewrite-section "API design" tighten\\ this')
    ).toEqual({
      type: "command",
      command: {
        name: "rewrite-section",
        args: ["API design", "tighten this"],
      },
    });
  });

  it("preserves an explicitly empty argument", () => {
    expect(parseSlashCommand('/translate ""')).toEqual({
      type: "command",
      command: { name: "translate", args: [""] },
    });
  });

  it("rejects unterminated quotes and escapes", () => {
    expect(parseSlashCommand('/new-post "unfinished')).toEqual({
      type: "invalid",
    });
    expect(parseSlashCommand("/new-post unfinished\\")).toEqual({
      type: "invalid",
    });
  });

  it("leaves ordinary prompts alone", () => {
    expect(parseSlashCommand("Write about /commands")).toEqual({
      type: "none",
    });
  });
});

describe("formatSlashCommand", () => {
  it("quotes arguments when their token boundary would be ambiguous", () => {
    expect(
      formatSlashCommand("rewrite-section", ["API design", "tighten"])
    ).toBe('/rewrite-section "API design" tighten');
  });
});

describe("findSlashCommand", () => {
  const names = new Set(["translate", "seo-pass"]);

  it("finds a known command in prose and parses only the following arguments", () => {
    expect(findSlashCommand("Please /translate en carefully", names)).toEqual({
      type: "command",
      command: { name: "translate", args: ["en", "carefully"] },
      token: { start: 7, end: 17, query: "translate" },
    });
  });

  it("ignores unknown slash tokens and URL paths", () => {
    expect(findSlashCommand("See https://example.com /unknown", names)).toEqual(
      { type: "none" }
    );
  });

  it("finds a known command directly after CJK text", () => {
    expect(findSlashCommand("請幫我/translate en", names)).toEqual({
      type: "command",
      command: { name: "translate", args: ["en"] },
      token: { start: 3, end: 13, query: "translate" },
    });
  });
});

describe("filterSlashMenuItems", () => {
  const items: SlashMenuItem[] = [
    {
      id: "command:new-post",
      kind: "command",
      name: "new-post",
      label: "/new-post",
      description: "Draft from a topic",
    },
    {
      id: "skill:seo-metadata",
      kind: "skill",
      name: "seo-metadata",
      label: "skill:seo-metadata",
      description: "Metadata rules",
    },
  ];

  it("matches names, labels, and descriptions without changing source order", () => {
    expect(filterSlashMenuItems(items, "meta").map((item) => item.id)).toEqual([
      "skill:seo-metadata",
    ]);
    expect(filterSlashMenuItems(items, "")).toEqual(items);
  });
});
