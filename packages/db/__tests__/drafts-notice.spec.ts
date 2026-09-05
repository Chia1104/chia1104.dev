import { describe, expect, it } from "vitest";

import { feedDraftNoticeSchema } from "../src/libs/drafts/notice.ts";

describe("feedDraftNoticeSchema", () => {
  it("accepts the three notices a draft write announces", () => {
    expect(
      feedDraftNoticeSchema.parse({
        type: "revision",
        draftId: 7,
        revision: 3,
        author: "agent",
        sessionId: "session-1",
        changes: [{ locale: "en", fields: ["content"] }, { fields: ["slug"] }],
      })
    ).toMatchObject({ type: "revision", revision: 3 });
    expect(
      feedDraftNoticeSchema.parse({
        type: "applied",
        draftId: 7,
        revision: 3,
        feedId: 42,
      })
    ).toMatchObject({ type: "applied", feedId: 42 });
    expect(
      feedDraftNoticeSchema.parse({ type: "discarded", draftId: 7 })
    ).toEqual({ type: "discarded", draftId: 7 });
  });

  it("refuses a notice it does not know, so a listener drops it instead of crashing", () => {
    expect(
      feedDraftNoticeSchema.safeParse({ type: "renamed", draftId: 7 }).success
    ).toBe(false);
  });

  it("stays far under NOTIFY's payload cap even when every field of every locale changed", () => {
    const notice = {
      type: "revision",
      draftId: 2_147_483_647,
      revision: 2_147_483_647,
      author: "operator",
      sessionId: crypto.randomUUID(),
      changes: [
        { fields: ["slug", "type", "defaultLocale", "mainImage"] },
        {
          locale: "zh-TW",
          fields: ["title", "excerpt", "description", "summary", "content"],
        },
        {
          locale: "en",
          fields: ["title", "excerpt", "description", "summary", "content"],
        },
      ],
    };
    expect(
      JSON.stringify(feedDraftNoticeSchema.parse(notice)).length
    ).toBeLessThan(1_000);
  });
});
