import { describe, expect, it } from "vitest";

import enUS from "@chia/i18n/agent-elements/en-US.json";
import zhTW from "@chia/i18n/agent-elements/zh-TW.json";

import { defaultAgentLabels, fill, mergeLabels } from "../src/labels.ts";
import type { AgentLabels } from "../src/labels.ts";

const keysOf = (catalog: AgentLabels) => ({
  top: Object.keys(catalog).sort(),
  levels: Object.keys(catalog.thinkingLevelNames).sort(),
});

describe("agent-elements catalogs", () => {
  it("ship the same keys in every locale", () => {
    expect(keysOf(zhTW)).toEqual(keysOf(enUS));
  });

  it("carry the placeholders the elements fill", () => {
    for (const catalog of [enUS, zhTW]) {
      expect(catalog.approvalTitle).toContain("{tool}");
      expect(catalog.alwaysAllow).toContain("{tier}");
      expect(catalog.contextCompactsAutomatically).toContain("{model}");
      expect(catalog.forkedFrom).toContain("{title}");
      expect(catalog.quotaExceeded).toContain("{resetAt}");
      expect(catalog.contextDetached).toContain("{label}");
    }
  });
});

describe("fill", () => {
  it("replaces known placeholders and leaves unknown ones", () => {
    expect(fill("Allow {tool}? {other}", { tool: "Commit" })).toBe(
      "Allow Commit? {other}"
    );
  });
});

describe("mergeLabels", () => {
  it("overlays a partial catalog on the default, nested levels included", () => {
    const merged = mergeLabels({
      send: "送出",
      thinkingLevelNames: {
        ...defaultAgentLabels.thinkingLevelNames,
        off: "關閉",
      },
    });
    expect(merged.send).toBe("送出");
    expect(merged.stop).toBe(defaultAgentLabels.stop);
    expect(merged.thinkingLevelNames.off).toBe("關閉");
    expect(merged.thinkingLevelNames.max).toBe(
      defaultAgentLabels.thinkingLevelNames.max
    );
  });
});
