import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";

import { agentQueryKeys } from "../src/queries.ts";
import { createAgentSessionStore, foldDetail } from "../src/store.ts";
import type { AgentSessionClient, AgentSessionDetail } from "../src/types.ts";

// ============================================
// Fixtures
// ============================================

const detailOf = (
  overrides: Partial<AgentSessionDetail> = {}
): AgentSessionDetail => ({
  session: {
    id: "s1",
    title: "Session",
    kind: "writing",
    createdAt: 0,
    updatedAt: 0,
  },
  settings: {
    providerId: "openai",
    modelId: "gpt-5",
    thinkingLevel: "medium",
    activeToolNames: null,
    autoApprove: [],
  },
  run: null,
  events: [],
  approvals: [],
  stats: { messageCount: 0, totalTokens: 0, costTotal: 0 },
  ...overrides,
});

/** A push-based event stream: the test controls when each event arrives and when it ends. */
const channel = () => {
  const queue: AgentWireEvent[] = [];
  let waiting: (() => void) | null = null;
  let closed = false;
  let returned = false;

  const iterable: AsyncIterable<AgentWireEvent> = {
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        while (queue.length === 0 && !closed) {
          await new Promise<void>((resolve) => {
            waiting = resolve;
          });
        }
        const value = queue.shift();
        return value
          ? { value, done: false as const }
          : { value: undefined, done: true as const };
      },
      return: async () => {
        returned = true;
        closed = true;
        waiting?.();
        return { value: undefined, done: true as const };
      },
    }),
  };

  return {
    iterable,
    push: (event: AgentWireEvent) => {
      queue.push(event);
      waiting?.();
      waiting = null;
    },
    close: () => {
      closed = true;
      waiting?.();
      waiting = null;
    },
    get returned() {
      return returned;
    },
  };
};

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const fakeClient = (overrides: {
  get?: () => Promise<AgentSessionDetail>;
  chat?: () => Promise<AsyncIterable<AgentWireEvent>>;
  abort?: () => Promise<{ aborted: boolean }>;
}) => {
  const get = vi.fn(overrides.get ?? (async () => detailOf()));
  const chat = vi.fn(
    overrides.chat ??
      (async () => {
        const stream = channel();
        stream.close();
        return stream.iterable;
      })
  );
  const abort = vi.fn(overrides.abort ?? (async () => ({ aborted: true })));
  const update = vi.fn(async () => detailOf());
  const models = vi.fn(async () => []);
  const client: AgentSessionClient = {
    sessions: { get, chat, abort, "settings:update": update },
    models: { list: models },
  };
  return { client, get, chat, abort, update, models };
};

const makeStore = (
  options: Omit<
    Parameters<typeof createAgentSessionStore>[0],
    "queryClient" | "sessionId"
  >
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = createAgentSessionStore({
    ...options,
    queryClient,
    sessionId: "s1",
  });
  const cachedDetail = () =>
    queryClient.getQueryData<AgentSessionDetail>(
      agentQueryKeys.session({ sessionId: "s1" })
    );
  return { store, queryClient, cachedDetail };
};

const turn = (text: string): AgentWireEvent[] => [
  { type: "run:start", sessionId: "s1" },
  { type: "user", messageId: "u1", text },
  { type: "assistant:start", messageId: "a1" },
  { type: "assistant:delta", messageId: "a1", channel: "text", delta: "Hi" },
  { type: "assistant:end", messageId: "a1", text: "Hi" },
  { type: "run:end", reason: "done" },
];

// ============================================
// foldDetail
// ============================================

describe("foldDetail", () => {
  it("re-applies server-side pending approvals the replay does not carry", () => {
    const view = foldDetail(
      detailOf({
        events: [
          { type: "user", messageId: "u1", text: "publish" },
          {
            type: "tool:start",
            toolCallId: "t1",
            toolName: "commit_post",
            label: "Commit post",
            tier: "commit",
            args: { slug: "x" },
          },
          {
            type: "tool:end",
            toolCallId: "t1",
            toolName: "commit_post",
            isError: true,
            summary: "blocked",
          },
        ],
        approvals: [
          {
            toolCallId: "t1",
            toolName: "commit_post",
            args: { slug: "x" },
            status: "pending",
          },
        ],
      })
    );
    expect(view.pendingApprovals.map((tool) => tool.toolCallId)).toEqual([
      "t1",
    ]);
    const tool = view.items.find((item) => item.kind === "tool");
    expect(tool).toMatchObject({ status: "awaiting_approval", tier: "commit" });
    expect(view.runStatus).toBe("awaiting_approval");
  });

  it("closes a decided approval's card on reload the way the live stream did", () => {
    const view = foldDetail(
      detailOf({
        events: [
          { type: "user", messageId: "u1", text: "publish" },
          {
            type: "tool:start",
            toolCallId: "t1",
            toolName: "commit_post",
            label: "Commit post",
            tier: "commit",
            args: { slug: "x" },
          },
          {
            type: "tool:end",
            toolCallId: "t1",
            toolName: "commit_post",
            isError: true,
            summary: "blocked",
          },
        ],
        approvals: [
          {
            toolCallId: "t1",
            toolName: "commit_post",
            args: { slug: "x" },
            status: "approved",
            comment: "ship it",
          },
        ],
      })
    );
    expect(view.pendingApprovals).toEqual([]);
    const tool = view.items.find((item) => item.kind === "tool");
    expect(tool).toMatchObject({
      status: "ok",
      approval: { approved: true, comment: "ship it" },
    });
    expect(view.runStatus).toBe("idle");
  });

  it("derives the run status from the server run, not the last replayed event", () => {
    const events: AgentWireEvent[] = [
      { type: "user", messageId: "u1", text: "hello" },
      { type: "assistant:end", messageId: "a1", text: "hi" },
    ];
    expect(foldDetail(detailOf({ events })).runStatus).toBe("idle");
    expect(
      foldDetail(detailOf({ events, run: { id: "r1", status: "running" } }))
        .runStatus
    ).toBe("running");
  });
});

// ============================================
// Store
// ============================================

describe("createAgentSessionStore", () => {
  it("hydrates the transcript from the server", async () => {
    const { client, get } = fakeClient({
      get: async () =>
        detailOf({
          events: [
            { type: "user", messageId: "u1", text: "hello" },
            { type: "assistant:end", messageId: "a1", text: "hi" },
          ],
        }),
    });
    const { store, cachedDetail } = makeStore({ client });

    await store.getState().hydrate();

    expect(get).toHaveBeenCalledWith({ sessionId: "s1", kind: undefined });
    expect(store.getState().connection).toBe("idle");
    expect(store.getState().view.items).toHaveLength(2);
    expect(cachedDetail()?.session.id).toBe("s1");
  });

  it("rejoins a running turn on hydrate", async () => {
    const stream = channel();
    const details = [
      detailOf({ run: { id: "r1", status: "running" } }),
      detailOf({ run: { id: "r1", status: "waiting" } }),
    ];
    const { client, chat } = fakeClient({
      get: async () => details.shift() ?? details[0]!,
      chat: async () => stream.iterable,
    });
    const { store, cachedDetail } = makeStore({ client });

    const hydrated = store.getState().hydrate();
    await flush();

    expect(chat).toHaveBeenCalledWith(
      { sessionId: "s1", kind: undefined, action: { type: "attach" } },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(store.getState().connection).toBe("streaming");

    stream.push({ type: "assistant:start", messageId: "a1" });
    await flush();
    expect(store.getState().view.items).toMatchObject([
      { kind: "assistant", streaming: true },
    ]);

    stream.push({ type: "assistant:end", messageId: "a1", text: "done" });
    stream.push({ type: "run:end", reason: "done" });
    stream.close();
    await hydrated;

    expect(store.getState().connection).toBe("idle");
    expect(cachedDetail()?.run?.status).toBe("waiting");
  });

  it("streams a prompt into the view and re-syncs when the turn ends", async () => {
    const stream = channel();
    let detail = detailOf();
    const onTurnEnd = vi.fn();
    const { client, get } = fakeClient({
      get: async () => detail,
      chat: async () => stream.iterable,
    });
    const { store, cachedDetail } = makeStore({ client, onTurnEnd });
    await store.getState().hydrate();

    const prompted = store.getState().prompt("hello");
    await flush();
    expect(store.getState().pendingPrompt).toBe("hello");
    expect(store.getState().connection).toBe("streaming");

    const events = turn("hello");
    stream.push(events[0]!);
    stream.push(events[1]!);
    await flush();
    // The echoed user event replaces the optimistic prompt.
    expect(store.getState().pendingPrompt).toBeNull();
    expect(store.getState().view.items).toMatchObject([
      { kind: "user", text: "hello" },
    ]);

    for (const event of events.slice(2)) stream.push(event);
    detail = detailOf({
      events: [
        { type: "user", messageId: "u1", text: "hello" },
        { type: "assistant:end", messageId: "a1", text: "Hi" },
      ],
      stats: { messageCount: 2, totalTokens: 10, costTotal: 0 },
    });
    stream.close();
    await prompted;

    expect(store.getState().connection).toBe("idle");
    // The live view is kept; only the detail is refreshed after `run:end`.
    expect(store.getState().view.items).toMatchObject([
      { kind: "user", text: "hello" },
      { kind: "assistant", text: "Hi", streaming: false },
    ]);
    expect(cachedDetail()?.stats.messageCount).toBe(2);
    expect(get).toHaveBeenCalledTimes(2);
    expect(onTurnEnd).toHaveBeenCalledTimes(1);
  });

  it("rebuilds from the server when a stream breaks before run:end", async () => {
    const stream = channel();
    let detail = detailOf();
    const { client } = fakeClient({
      get: async () => detail,
      chat: async () => stream.iterable,
    });
    const { store } = makeStore({ client });
    await store.getState().hydrate();

    const prompted = store.getState().prompt("hello");
    await flush();
    stream.push({ type: "user", messageId: "u1", text: "hello" });
    await flush();

    detail = detailOf({
      events: [
        { type: "user", messageId: "u1", text: "hello" },
        { type: "assistant:end", messageId: "a1", text: "recovered" },
      ],
    });
    stream.close();
    await prompted;

    expect(store.getState().view.items).toMatchObject([
      { kind: "user" },
      { kind: "assistant", text: "recovered" },
    ]);
  });

  it("returns the prompt to the caller when the request fails", async () => {
    const { client } = fakeClient({
      chat: async () => {
        throw new Error("offline");
      },
    });
    const { store } = makeStore({ client });
    await store.getState().hydrate();

    await expect(store.getState().prompt("hello")).rejects.toThrow("offline");
    expect(store.getState().pendingPrompt).toBeNull();
    expect(store.getState().failure).toBe("offline");
    expect(store.getState().connection).toBe("idle");
  });

  it("forwards state:changed to the host while streaming", async () => {
    const stream = channel();
    const onStateChanged = vi.fn();
    const { client } = fakeClient({ chat: async () => stream.iterable });
    const { store } = makeStore({ client, onStateChanged });
    await store.getState().hydrate();

    const prompted = store.getState().prompt("draft it");
    await flush();
    stream.push({ type: "state:changed", scope: "draft", revision: 3 });
    await flush();
    expect(onStateChanged).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "draft", revision: 3 })
    );
    stream.push({ type: "run:end", reason: "done" });
    stream.close();
    await prompted;
  });

  it("sends an approval decision as a follow-up turn", async () => {
    const stream = channel();
    const { client, chat } = fakeClient({ chat: async () => stream.iterable });
    const { store } = makeStore({ client });
    await store.getState().hydrate();

    const approved = store.getState().approve("t1", true, "go");
    await flush();
    expect(chat).toHaveBeenLastCalledWith(
      {
        sessionId: "s1",
        kind: undefined,
        action: {
          type: "approve",
          toolCallId: "t1",
          approved: true,
          comment: "go",
        },
      },
      expect.anything()
    );
    stream.push({ type: "run:end", reason: "done" });
    stream.close();
    await approved;
  });

  it("hydrate cancels an open stream and rebuilds from the server", async () => {
    const stream = channel();
    let detail = detailOf({ run: { id: "r1", status: "waiting" } });
    const { client, get } = fakeClient({
      get: async () => detail,
      chat: async () => stream.iterable,
    });
    const { store, cachedDetail } = makeStore({ client });
    await store.getState().hydrate();

    const prompted = store.getState().prompt("long task");
    await flush();
    stream.push({ type: "user", messageId: "u1", text: "long task" });
    await flush();

    // What `useAbortSession` does after the server confirmed the abort.
    detail = detailOf({
      run: null,
      events: [{ type: "user", messageId: "u1", text: "long task" }],
    });
    await store.getState().hydrate();
    await prompted;

    expect(stream.returned).toBe(true);
    expect(store.getState().connection).toBe("idle");
    expect(cachedDetail()?.run).toBeNull();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("dispose closes the stream and drops late events", async () => {
    const stream = channel();
    const { client } = fakeClient({ chat: async () => stream.iterable });
    const { store } = makeStore({ client });
    await store.getState().hydrate();

    const prompted = store.getState().prompt("hello");
    await flush();
    store.getState().dispose();
    stream.push({ type: "user", messageId: "u1", text: "hello" });
    stream.close();
    await prompted;

    expect(stream.returned).toBe(true);
    expect(store.getState().view.items).toHaveLength(0);
  });
});
