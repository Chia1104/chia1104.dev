import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import type { FeedDraftRecord } from "@chia/db/repos/drafts";
import { AppError } from "@chia/service-kit/errors";

import { FeedDraftBus } from "../feeds/draft-bus";

interface TrailRow {
  revision: number;
  author: "operator" | "agent";
}

/** What the mocked repository answers with: the row itself and its revision trail. */
interface WatchedDraft {
  draft: FeedDraftRecord | null;
  rows: TrailRow[];
}

const state = vi.hoisted((): WatchedDraft => ({ draft: null, rows: [] }));

vi.mock("@chia/db/repos/drafts", () => ({
  getFeedDraft: vi.fn(async () => state.draft),
  listFeedDraftRevisionsSince: vi.fn(
    async (_db: DB, input: { afterRevision: number }) =>
      state.rows
        .filter((row) => row.revision > input.afterRevision)
        .map((row) => ({
          id: row.revision,
          draftId: 7,
          revision: row.revision,
          author: row.author,
          sessionId: row.author === "agent" ? "session-1" : null,
          changes: [{ locale: "en", fields: ["content"] }],
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
  ),
}));

const { watchFeedDraft } = await import("../feeds/draft-watch");

/* SAFETY: every repository read in this suite is mocked. */
const db = {} as DB;

const record = (): FeedDraftRecord => ({
  id: 7,
  feedId: null,
  userId: "admin",
  slug: null,
  type: "post",
  defaultLocale: "zh-TW",
  mainImage: null,
  revision: 1,
  appliedRevision: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  translations: {},
});

describe("watchFeedDraft", () => {
  beforeEach(() => {
    state.draft = record();
    state.rows = [];
  });

  it("refuses a draft the caller does not own before streaming anything", async () => {
    state.draft = { ...record(), userId: "someone-else" };
    await expect(
      watchFeedDraft(db, { draftId: 7, adminId: "admin", afterRevision: 0 })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("replays the trail above the cursor, then wakes on a bus notice", async () => {
    state.rows = [
      { revision: 2, author: "operator" },
      { revision: 3, author: "agent" },
    ];
    const bus = new FeedDraftBus();
    const controller = new AbortController();
    const events = await watchFeedDraft(db, {
      draftId: 7,
      adminId: "admin",
      afterRevision: 2,
      bus,
      signal: controller.signal,
      pollMs: 10_000,
    });

    const replayed = await events.next();
    expect(replayed.value).toMatchObject({
      type: "revision",
      revision: 3,
      author: "agent",
      sessionId: "session-1",
    });

    // The loop is now parked on the bus; a write lands and the trail grows.
    const pending = events.next();
    state.rows.push({ revision: 4, author: "operator" });
    bus.publish({
      type: "revision",
      draftId: 7,
      revision: 4,
      author: "operator",
      sessionId: null,
      changes: [],
    });
    expect((await pending).value).toMatchObject({
      type: "revision",
      revision: 4,
    });

    controller.abort();
    await expect(events.next()).resolves.toMatchObject({ done: true });
  });

  it("reports an apply once and ends after a discard", async () => {
    const events = await watchFeedDraft(db, {
      draftId: 7,
      adminId: "admin",
      afterRevision: 1,
      pollMs: 1,
      pingMs: 60_000,
    });

    state.draft = { ...record(), feedId: 42, appliedRevision: 1 };
    expect((await events.next()).value).toEqual({
      type: "applied",
      draftId: 7,
      revision: 1,
      feedId: 42,
    });

    state.draft = null;
    expect((await events.next()).value).toEqual({
      type: "discarded",
      draftId: 7,
    });
    await expect(events.next()).resolves.toMatchObject({ done: true });
  });

  it("pings an idle stream so the connection stays open", async () => {
    const events = await watchFeedDraft(db, {
      draftId: 7,
      adminId: "admin",
      afterRevision: 1,
      pollMs: 1,
      pingMs: 0,
    });
    expect((await events.next()).value).toEqual({ type: "ping" });
    await events.return();
  });
});
