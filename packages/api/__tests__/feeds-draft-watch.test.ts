import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "@chia/db/client";
import { getFeedDraftStatus } from "@chia/db/repos/drafts";
import { AppError } from "@chia/service-kit/errors";

import { FeedDraftBus } from "../feeds/draft-bus";
import { watchFeedDraft } from "../feeds/draft-watch";

vi.mock("@chia/db/repos/drafts", () => ({
  getFeedDraftStatus: vi.fn(),
}));

/* SAFETY: all database access is mocked. */
const db = {} as DB;
const status = {
  userId: "admin",
  feedId: null,
  revision: 1,
  appliedRevision: null,
};
const changed = { type: "discarded", draftId: 7 } as const;

const open = (bus = new FeedDraftBus(), signal?: AbortSignal) =>
  watchFeedDraft(db, { draftId: 7, adminId: "admin", bus, signal });

describe("draft invalidations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getFeedDraftStatus).mockReset().mockResolvedValue(status);
  });
  afterEach(() => vi.useRealTimers());

  it("rejects another owner's draft before opening a stream", async () => {
    vi.mocked(getFeedDraftStatus).mockResolvedValue({
      ...status,
      userId: "other",
    });
    await expect(open()).rejects.toBeInstanceOf(AppError);
  });

  it("requires a bus instead of silently polling", async () => {
    await expect(
      watchFeedDraft(db, { draftId: 7, adminId: "admin" })
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("resyncs on every connection even when the draft was deleted offline", async () => {
    for (const value of [status, null]) {
      vi.mocked(getFeedDraftStatus).mockResolvedValue(value);
      const events = await open();
      expect((await events.next()).value).toEqual({ type: "resync" });
      await events.return();
    }
  });

  it("coalesces notifications received while the consumer is reading", async () => {
    const bus = new FeedDraftBus();
    const events = await open(bus);
    await events.next();
    bus.publish(changed);
    bus.publish(changed);
    expect((await events.next()).value).toEqual({ type: "resync" });
    const idle = events.next();
    await vi.advanceTimersByTimeAsync(30_000);
    expect((await idle).value).toEqual({ type: "ping" });
    expect(getFeedDraftStatus).toHaveBeenCalledTimes(1);
    await events.return();
  });

  it("fans out writes and listener recovery to all local watchers", async () => {
    const bus = new FeedDraftBus();
    const streams = await Promise.all([open(bus), open(bus)]);
    for (const stream of streams) await stream.next();
    const waiting = streams.map((stream) => stream.next());
    bus.publish(changed);
    for (const pending of waiting) {
      expect((await pending).value).toEqual({ type: "resync" });
    }
    bus.resync();
    for (const stream of streams) {
      expect((await stream.next()).value).toEqual({ type: "resync" });
      await stream.return();
    }
  });

  it("ignores other drafts and removes subscriptions and timers on abort", async () => {
    const bus = new FeedDraftBus();
    const unsubscribe = vi.fn();
    const subscribe = bus.subscribe.bind(bus);
    vi.spyOn(bus, "subscribe").mockImplementation((id, listener) => {
      const remove = subscribe(id, listener);
      return () => {
        remove();
        unsubscribe();
      };
    });
    const controller = new AbortController();
    const events = await open(bus, controller.signal);
    await events.next();
    bus.publish({ ...changed, draftId: 8 });
    const pending = events.next();
    controller.abort();
    expect((await pending).done).toBe(true);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
