import { describe, expect, it } from "vitest";

import {
  diffFeedDraftSnapshots,
  needsSafetyPoint,
} from "../src/libs/drafts/index.ts";
import type { FeedDraftSnapshot } from "../src/schemas/schema.ts";

const operator = { author: "operator", sessionId: null } as const;
const agent = { author: "agent", sessionId: "s1" } as const;
const at = (minutes: number) => new Date(2026, 8, 17, 10, minutes);

const state = (
  revision: number,
  last: { author: "operator" | "agent"; sessionId: string | null }
) => ({ revision, lastAuthor: last.author, lastSessionId: last.sessionId });

describe("needsSafetyPoint", () => {
  it("skips a state that is already held", () => {
    expect(
      needsSafetyPoint({
        current: state(5, operator),
        latest: { revision: 5, createdAt: at(0) },
        writer: agent,
        now: at(30).getTime(),
        force: true,
      })
    ).toBe(false);
  });

  it("keeps the state a different writer takes over", () => {
    const latest = { revision: 3, createdAt: at(0) };
    const now = at(1).getTime();
    expect(
      needsSafetyPoint({
        current: state(5, operator),
        latest,
        writer: agent,
        now,
      })
    ).toBe(true);
    expect(
      needsSafetyPoint({
        current: state(5, agent),
        latest,
        writer: operator,
        now,
      })
    ).toBe(true);
    expect(
      needsSafetyPoint({
        current: state(5, agent),
        latest,
        writer: { author: "agent", sessionId: "s2" },
        now,
      })
    ).toBe(true);
  });

  it("keeps one state per interval while the same writer continues", () => {
    const latest = { revision: 3, createdAt: at(0) };
    const input = { current: state(5, operator), latest, writer: operator };
    expect(needsSafetyPoint({ ...input, now: at(9).getTime() })).toBe(false);
    expect(needsSafetyPoint({ ...input, now: at(10).getTime() })).toBe(true);
  });

  it("keeps the state before a whole-draft replacement", () => {
    expect(
      needsSafetyPoint({
        current: state(5, operator),
        latest: { revision: 3, createdAt: at(0) },
        writer: operator,
        now: at(1).getTime(),
        force: true,
      })
    ).toBe(true);
  });
});

describe("diffFeedDraftSnapshots", () => {
  const translation = {
    title: "T",
    excerpt: null,
    description: null,
    summary: null,
    content: "body",
  };
  const base: FeedDraftSnapshot = {
    slug: "a",
    type: "post",
    defaultLocale: "en",
    mainImage: null,
    translations: { en: translation },
  };

  it("is empty for equal snapshots", () => {
    expect(diffFeedDraftSnapshots(base, structuredClone(base))).toEqual([]);
  });

  it("names changed feed-level and per-locale fields", () => {
    expect(
      diffFeedDraftSnapshots(base, {
        ...base,
        slug: "b",
        translations: { en: { ...translation, content: "next" } },
      })
    ).toEqual([{ fields: ["slug"] }, { locale: "en", fields: ["content"] }]);
  });

  it("reports a locale that appears or disappears, even an empty one", () => {
    const empty = {
      title: null,
      excerpt: null,
      description: null,
      summary: null,
      content: null,
    };
    expect(
      diffFeedDraftSnapshots(base, {
        ...base,
        translations: { en: translation, "zh-TW": empty },
      })
    ).toEqual([
      {
        locale: "zh-TW",
        fields: ["title", "excerpt", "description", "summary", "content"],
      },
    ]);
    expect(diffFeedDraftSnapshots(base, { ...base, translations: {} })).toEqual(
      [{ locale: "en", fields: ["title", "content"] }]
    );
  });

  it("reads a missing baseline as everything changed", () => {
    expect(diffFeedDraftSnapshots(null, base)).toEqual([
      { fields: ["slug", "type", "defaultLocale", "mainImage"] },
      { locale: "en", fields: ["title", "content"] },
    ]);
  });
});
