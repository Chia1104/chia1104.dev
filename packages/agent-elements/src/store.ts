import { createStore } from "zustand/vanilla";

import type { AgentViewState } from "@chia/agent-runtime/wire/fold";
import {
  applyEvent,
  emptyViewState,
  foldEvents,
} from "@chia/agent-runtime/wire/fold";
import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";

import { consumeStream } from "./stream.ts";
import type {
  AgentSessionClient,
  AgentModel,
  AgentModelRef,
  AgentSessionDetail,
  AgentThinkingLevel,
} from "./types.ts";

export type AgentConnection = "hydrating" | "idle" | "streaming";

export type AgentRunStatus = AgentViewState["runStatus"];

export interface AgentSessionState {
  sessionId: string;
  kind: string | undefined;
  detail: AgentSessionDetail | null;
  view: AgentViewState;
  connection: AgentConnection;
  /** Prompt already sent, shown until the stream echoes it back as a `user` event. */
  pendingPrompt: string | null;
  models: AgentModel[] | null;
  /**
   * A transport or request failure. Agent-side failures arrive as `error` wire events and live in
   * the transcript instead.
   */
  failure: string | null;
}

export interface AgentSessionActions {
  /** Loads the server-owned transcript and rejoins a turn that is still running. */
  hydrate: () => Promise<void>;
  /** Refetches `detail` (settings, run, kind state) without touching the transcript view. */
  refreshDetail: () => Promise<void>;
  /** Rejects when the request itself fails; stream failures land in `failure`. */
  prompt: (text: string) => Promise<void>;
  approve: (
    toolCallId: string,
    approved: boolean,
    comment?: string
  ) => Promise<void>;
  abort: () => Promise<void>;
  updateSettings: (input: {
    model?: AgentModelRef;
    thinkingLevel?: AgentThinkingLevel;
    autoApprove?: string[];
  }) => Promise<void>;
  loadModels: () => Promise<void>;
  dismissFailure: () => void;
  /** Cancels any open stream. The store is unusable afterwards. */
  dispose: () => void;
}

export type AgentSessionStore = AgentSessionState & AgentSessionActions;

export interface AgentSessionCallbacks {
  /** A tool changed durable state the host renders (e.g. the writing draft) — refetch it. */
  onStateChanged?: (event: { scope?: string; revision: number }) => void;
  /** A turn's stream ended, for any reason, and the store has re-synced with the server. */
  onTurnEnd?: () => void;
}

export interface AgentSessionStoreOptions extends AgentSessionCallbacks {
  client: AgentSessionClient;
  sessionId: string;
  kind?: string;
}

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * The persisted transcript never replays approval events, so the server lists undecided
 * approvals separately; they are re-applied here so a reload restores the prompt in place.
 */
export const foldDetail = (detail: AgentSessionDetail): AgentViewState => {
  let view = foldEvents(detail.events);
  for (const approval of detail.pendingApprovals) {
    if (
      view.pendingApprovals.some(
        (pending) => pending.toolCallId === approval.toolCallId
      )
    ) {
      continue;
    }
    const tool = view.items.find(
      (item) => item.kind === "tool" && item.toolCallId === approval.toolCallId
    );
    view = applyEvent(view, {
      type: "approval:request",
      toolCallId: approval.toolCallId,
      toolName: approval.toolName,
      tier: tool?.kind === "tool" ? tool.tier : "",
      args: approval.args ?? (tool?.kind === "tool" ? tool.args : undefined),
    });
  }
  // Replay carries no run boundaries, so the reducer's status reflects the last event, not the run.
  const runStatus: AgentRunStatus =
    detail.run?.status === "running"
      ? "running"
      : view.pendingApprovals.length > 0
        ? "awaiting_approval"
        : view.runStatus === "error"
          ? "error"
          : "idle";
  return { ...view, runStatus };
};

export const createAgentSessionStore = ({
  client,
  kind,
  onStateChanged,
  onTurnEnd,
  sessionId,
}: AgentSessionStoreOptions) => {
  let controller: AbortController | null = null;
  // Bumped whenever a stream or hydrate is superseded; late results check it before writing.
  let generation = 0;

  return createStore<AgentSessionStore>()((set, get) => {
    const stopStream = () => {
      controller?.abort();
      controller = null;
    };

    const scoped = { sessionId, kind };

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    /**
     * Re-syncs `detail` after a turn ended with `run:end`, keeping the view the stream built.
     *
     * The step clears its running marker only after the terminal event is flushed, so a `get`
     * issued straight away can still report the finished turn as running; that is retried briefly.
     * If the run genuinely stays running, a queued message started another turn — rejoin it.
     */
    const settle = async (mine: number) => {
      for (let attempt = 0; attempt < 5; attempt++) {
        let detail: AgentSessionDetail;
        try {
          detail = await client.sessions.get(scoped);
        } catch (cause) {
          if (mine === generation) set({ failure: messageOf(cause) });
          return;
        }
        if (mine !== generation) return;
        if (detail.run?.status !== "running") {
          set({ detail });
          return;
        }
        await sleep(200 * (attempt + 1));
        if (mine !== generation) return;
      }
      await get().hydrate();
    };

    // Consecutive streams that ended without progress; backs off the reconnect.
    let brokenStreak = 0;

    /**
     * Runs one turn stream. Rejects only when `start` (the request) fails, so the caller can react
     * — for example put the prompt back into the composer. Everything after that is a state
     * change: events fold into the view, and a mid-stream failure lands in `failure`.
     *
     * When the stream is cancelled by this store (abort, dispose, a newer hydrate or run), the
     * canceller owns what happens next; `run` only re-syncs streams that ended on their own.
     */
    const run = async (
      start: (signal: AbortSignal) => Promise<AsyncIterable<AgentWireEvent>>
    ) => {
      stopStream();
      const own = new AbortController();
      controller = own;
      const mine = ++generation;
      set({ connection: "streaming", failure: null });

      let iterable: AsyncIterable<AgentWireEvent>;
      try {
        iterable = await start(own.signal);
      } catch (cause) {
        if (controller === own) controller = null;
        if (mine === generation) set({ connection: "idle" });
        throw cause;
      }

      let ended = false;
      try {
        await consumeStream(
          iterable,
          (event) => {
            if (mine !== generation) return;
            brokenStreak = 0;
            if (event.type === "run:end") ended = true;
            set((state) => ({
              view: applyEvent(state.view, event),
              pendingPrompt: event.type === "user" ? null : state.pendingPrompt,
            }));
            if (event.type === "state:changed") {
              // Kind state (a draft, …) rides on `detail`; refresh it while the turn is still going.
              void get().refreshDetail();
              onStateChanged?.(event);
            }
          },
          own.signal
        );
      } catch (cause) {
        if (!own.signal.aborted && mine === generation) {
          set({ failure: messageOf(cause) });
        }
      } finally {
        if (controller === own) controller = null;
      }
      if (own.signal.aborted || mine !== generation) return;

      set({ connection: "idle", pendingPrompt: null });
      if (ended) {
        await settle(mine);
      } else {
        // Broke before `run:end` (connection lost, server restarted): rebuild and rejoin, but not
        // in a tight loop if the server keeps saying "running" while the stream keeps dropping.
        brokenStreak++;
        await sleep(Math.min(500 * 2 ** (brokenStreak - 1), 10_000));
        if (mine !== generation) return;
        await get().hydrate();
      }
      onTurnEnd?.();
    };

    const attach = () =>
      run((signal) =>
        client.sessions.chat(
          { ...scoped, action: { type: "attach" } },
          { signal }
        )
      );

    return {
      sessionId,
      kind,
      detail: null,
      view: emptyViewState(),
      connection: "idle",
      pendingPrompt: null,
      models: null,
      failure: null,

      hydrate: async () => {
        const mine = ++generation;
        stopStream();
        set({ connection: "hydrating" });
        let detail: AgentSessionDetail;
        try {
          detail = await client.sessions.get(scoped);
        } catch (cause) {
          if (mine === generation) {
            set({ connection: "idle", failure: messageOf(cause) });
          }
          return;
        }
        if (mine !== generation) return;
        set({ detail, view: foldDetail(detail), connection: "idle" });
        if (detail.run?.status === "running") {
          try {
            await attach();
          } catch {
            // Usually the turn finished between `get` and `attach` (NOT_FOUND); the fresh detail
            // says so, and a real transport failure surfaces from that read instead.
            if (mine === generation) await get().refreshDetail();
          }
        }
      },

      refreshDetail: async () => {
        const mine = generation;
        try {
          const detail = await client.sessions.get(scoped);
          if (mine === generation) set({ detail });
        } catch (cause) {
          if (mine === generation) set({ failure: messageOf(cause) });
        }
      },

      prompt: async (text) => {
        set({ pendingPrompt: text, failure: null });
        try {
          await run((signal) =>
            client.sessions.chat(
              { ...scoped, action: { type: "prompt", text } },
              { signal }
            )
          );
        } catch (cause) {
          set({ pendingPrompt: null, failure: messageOf(cause) });
          throw cause;
        }
      },

      approve: async (toolCallId, approved, comment) => {
        try {
          await run((signal) =>
            client.sessions.chat(
              {
                ...scoped,
                action: { type: "approve", toolCallId, approved, comment },
              },
              { signal }
            )
          );
        } catch (cause) {
          set({ failure: messageOf(cause) });
          throw cause;
        }
      },

      abort: async () => {
        try {
          await client.sessions.abort(scoped);
        } catch (cause) {
          set({ failure: messageOf(cause) });
          throw cause;
        }
        // Whether or not a run was live, the server is the truth now — resync from it.
        stopStream();
        await get().hydrate();
      },

      updateSettings: async (input) => {
        try {
          const detail = await client.sessions["settings:update"]({
            ...scoped,
            ...input,
          });
          set({ detail });
        } catch (cause) {
          set({ failure: messageOf(cause) });
          throw cause;
        }
      },

      loadModels: async () => {
        if (get().models) return;
        const sessionKind = kind ?? get().detail?.session.kind;
        if (!sessionKind) return;
        try {
          const models = await client.models.list({ kind: sessionKind });
          set({ models });
        } catch (cause) {
          set({ failure: messageOf(cause) });
        }
      },

      dismissFailure: () => set({ failure: null }),

      dispose: () => {
        generation++;
        stopStream();
      },
    };
  });
};

export type AgentSessionStoreApi = ReturnType<typeof createAgentSessionStore>;

// ============================================
// Selectors
// ============================================

export type AgentStatus = "awaiting_approval" | "error" | "idle" | "running";

/** What the session is doing right now, from the live connection first and the server second. */
export const selectStatus = (state: AgentSessionState): AgentStatus => {
  if (state.connection === "streaming") return "running";
  if (state.view.pendingApprovals.length > 0) return "awaiting_approval";
  if (state.detail?.run?.status === "running") return "running";
  return state.view.runStatus === "error" ? "error" : "idle";
};

/** A turn is executing (here or elsewhere) — the composer offers Stop instead of Send. */
export const selectIsBusy = (state: AgentSessionState): boolean =>
  state.connection === "streaming" || state.detail?.run?.status === "running";

export const selectCanPrompt = (state: AgentSessionState): boolean =>
  state.detail !== null &&
  state.connection === "idle" &&
  state.detail.run?.status !== "running" &&
  state.view.pendingApprovals.length === 0;
