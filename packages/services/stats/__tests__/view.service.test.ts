import Keyv from "keyv";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CallerTier } from "@chia/auth/tier";
import type { DB } from "@chia/db/client";
import type { PageViewInsert } from "@chia/db/repos/stats";
import { FeedType, Locale } from "@chia/db/types";

const { stats } = vi.hoisted(() => ({
  stats: {
    insertPageView: vi.fn<(db: DB, row: PageViewInsert) => Promise<void>>(
      async () => undefined
    ),
  },
}));

/** Rows handed to the repository, in call order. */
const rows = () => stats.insertPageView.mock.calls.map(([, row]) => row);

vi.mock("@chia/db/repos/stats", () => stats);

const { recordPageView } = await import("../view.service");

const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

/** The repository is mocked, so the handle is never touched. */
const db: DB =
  /* SAFETY: `insertPageView` is mocked and is the only use. */ {} as never;

const request = (
  overrides: {
    tier?: CallerTier;
    userAgent?: string | null;
    clientIP?: string;
    kv?: Keyv;
  } = {}
) => {
  const headers = new Headers({ "cf-ipcountry": "TW" });
  const userAgent =
    overrides.userAgent === undefined ? BROWSER : overrides.userAgent;
  if (userAgent) headers.set("user-agent", userAgent);
  return {
    db,
    kv: overrides.kv ?? new Keyv(),
    headers,
    clientIP: overrides.clientIP ?? "203.0.113.7",
    caller: { tier: overrides.tier ?? CallerTier.Anonymous, adminId: "admin" },
  };
};

const view = { path: "/posts/rag-reranking-jev", locale: Locale.En };

beforeEach(() => {
  stats.insertPageView.mockClear();
});

describe("recordPageView", () => {
  it("records a post view against its feed, with the visitor hashed", async () => {
    await recordPageView(request(), {
      ...view,
      referrer: "https://news.ycombinator.com/item?id=1",
    });

    expect(stats.insertPageView).toHaveBeenCalledWith(db, {
      path: "/posts/rag-reranking-jev",
      locale: Locale.En,
      visitor: expect.stringMatching(/^[\w-]{22}$/),
      feed: { type: FeedType.Post, slug: "rag-reranking-jev" },
      referrerHost: "news.ycombinator.com",
      country: "TW",
    });
  });

  it("links a note path to a note and other pages to no feed", async () => {
    const kv = new Keyv();
    await recordPageView(request({ kv }), { ...view, path: "/notes/a-note" });
    await recordPageView(request({ kv }), { ...view, path: "/tags/ai" });
    await recordPageView(request({ kv }), { ...view, path: "/" });

    expect(rows().map((row) => row.feed)).toEqual([
      { type: FeedType.Note, slug: "a-note" },
      null,
      null,
    ]);
  });

  it("drops the referrer when it is the site itself", async () => {
    await recordPageView(request(), {
      ...view,
      referrer: "http://localhost:3000/posts",
    });

    expect(rows()[0]?.referrerHost).toBeNull();
  });

  it("counts a repeat of the same page by the same visitor once", async () => {
    const kv = new Keyv();
    await recordPageView(request({ kv }), view);
    await recordPageView(request({ kv }), view);
    await recordPageView(request({ kv }), { ...view, path: "/posts/other" });

    expect(stats.insertPageView).toHaveBeenCalledTimes(2);
    const [first, second] = rows();
    expect(first?.visitor).toBe(second?.visitor);
  });

  it("tells visitors apart by address", async () => {
    const kv = new Keyv();
    await recordPageView(request({ kv, clientIP: "203.0.113.7" }), view);
    await recordPageView(request({ kv, clientIP: "198.51.100.2" }), view);

    const [first, second] = rows();
    expect(first?.visitor).not.toBe(second?.visitor);
  });

  it.each([
    ["a crawler", { userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" }],
    ["no user agent", { userAgent: null }],
    ["the operator", { tier: CallerTier.Root }],
    ["an API-key caller", { tier: CallerTier.ApiKey }],
  ])("skips %s", async (_, overrides) => {
    await recordPageView(request(overrides), view);

    expect(stats.insertPageView).not.toHaveBeenCalled();
  });

  it("counts signed-in readers and guests", async () => {
    await recordPageView(request({ tier: CallerTier.Session }), view);
    await recordPageView(
      request({ tier: CallerTier.Guest, clientIP: "198.51.100.2" }),
      view
    );

    expect(stats.insertPageView).toHaveBeenCalledTimes(2);
  });
});
