import { EventEmitter, getEventListeners } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const connections = vi.hoisted(() => {
  const clients: EventEmitter[] = [];
  return { clients };
});

vi.mock("pg", () => ({
  Client: class extends EventEmitter {
    constructor() {
      super();
      connections.clients.push(this);
    }
    connect = vi.fn(async () => undefined);
    query = vi.fn(async () => undefined);
    end = vi.fn(async () => {
      this.emit("end");
    });
    escapeIdentifier = (value: string) => `"${value}"`;
  },
}));

const { listenChannel } = await import("../src/libs/listen.ts");

describe("listenChannel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    connections.clients = [];
  });
  afterEach(() => vi.useRealTimers());

  it("cleans retry listeners after reconnecting and stops retrying on abort", async () => {
    const controller = new AbortController();
    const onConnect = vi.fn();
    const onError = vi.fn();
    const onNotice = vi.fn();
    listenChannel("postgres://unused", "feed_draft", onNotice, {
      signal: controller.signal,
      onConnect,
      onError,
    });
    await vi.advanceTimersByTimeAsync(0);

    for (let i = 0; i < 15; i += 1) {
      connections.clients.at(-1)?.emit("error", new Error("Connection lost"));
      expect(getEventListeners(controller.signal, "abort")).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(getEventListeners(controller.signal, "abort")).toHaveLength(1);
    }
    expect(onConnect).toHaveBeenCalledTimes(16);
    expect(onError).toHaveBeenCalledTimes(15);
    connections.clients.at(-1)?.emit("notification", {
      channel: "feed_draft",
      payload: "notice",
    });
    expect(onNotice).toHaveBeenCalledWith("notice");

    connections.clients.at(-1)?.emit("error", new Error("Connection lost"));
    controller.abort();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(connections.clients).toHaveLength(16);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
