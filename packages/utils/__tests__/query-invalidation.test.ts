import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryInvalidator } from "../src/query-client";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("live query invalidation", () => {
  it("coalesces bursts and retains changes received during a slow request", async () => {
    const client = new QueryClient();
    let finish: (value: number) => void = vi.fn();
    const read = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          finish = resolve;
        })
    );
    const observer = new QueryObserver(client, {
      queryKey: ["draft", 7],
      queryFn: read,
      initialData: 0,
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(vi.fn());
    const refresh = createQueryInvalidator(client, ["draft", 7]);
    try {
      for (let i = 0; i < 20; i++) refresh.request();
      await vi.advanceTimersByTimeAsync(1000);
      expect(read).toHaveBeenCalledTimes(1);
      refresh.request();
      refresh.request();
      for (let i = 0; i < 5; i++) {
        refresh.request();
        await vi.advanceTimersByTimeAsync(1000);
      }
      expect(read).toHaveBeenCalledTimes(1);
      finish(1);
      await vi.advanceTimersByTimeAsync(1000);
      expect(read).toHaveBeenCalledTimes(2);
      finish(2);
      await vi.advanceTimersByTimeAsync(5000);
      expect(read).toHaveBeenCalledTimes(2);
      expect(client.getQueryData(["draft", 7])).toBe(2);
    } finally {
      refresh.dispose();
      unsubscribe();
      client.clear();
    }
  });

  it("cancels pending refreshes when the consumer leaves", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const refresh = createQueryInvalidator(client, ["session", "s1"]);
    refresh.request();
    refresh.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(invalidate).not.toHaveBeenCalled();
    client.clear();
  });
  it("drops queued work on disposal without cancelling the active query", async () => {
    const client = new QueryClient();
    const pending = Promise.withResolvers<void>();
    const invalidate = vi
      .spyOn(client, "invalidateQueries")
      .mockReturnValue(pending.promise);
    const refresh = createQueryInvalidator(client, ["session", "s1"]);
    refresh.request();
    await vi.advanceTimersByTimeAsync(1000);
    refresh.request();
    await vi.advanceTimersByTimeAsync(1000);
    refresh.dispose();
    pending.resolve();
    await vi.advanceTimersByTimeAsync(5000);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    client.clear();
  });
});
