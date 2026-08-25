import { Throttler } from "@tanstack/react-pacer";
import type { QueryClient } from "@tanstack/react-query";
import { createStore } from "zustand/vanilla";

import type { AgentViewState } from "@chia/agent-runtime/wire/fold";
import {
  applyEvent,
  emptyViewState,
  foldEvents,
} from "@chia/agent-runtime/wire/fold";
import type { AgentWireEvent } from "@chia/agent-runtime/wire/schema";

import type { AgentLabels } from "./labels.ts";
import { mergeLabels } from "./labels.ts";
import { agentQueryKeys, sessionDetailQuery } from "./queries.ts";
import { formatSlashCommand } from "./slash-command.ts";
import { consumeStream } from "./stream.ts";
import type { AgentSessionClient, AgentSessionDetail } from "./types.ts";

export type AgentConnection = "hydrating" | "idle" | "streaming";

export type AgentRunStatus = AgentViewState["runStatus"];

export interface ComposerSeed {
  id: number;
  text: string;
}

/**
 * The live side of a session: the folded transcript and the turn stream feeding it. Everything
 * the server owns and answers on request (detail, models, settings) lives in the query cache
 * (`./queries.ts`); the store reads the detail through that cache and refreshes it there.
 */
export interface AgentSessionState {
  sessionId: string;
  kind: string | undefined;
  /** The catalog every element renders from; the host supplies its locale's. */
  labels: AgentLabels;
  view: AgentViewState;
  connection: AgentConnection;
  /** Prompt already sent, shown until the stream echoes it back as a `user` event. */
  pendingPrompt: string | null;
  /**
   * Text handed to the composer to take over — a rewound prompt given back for editing. An
   * event, not state: `id` grows with every hand-off, and the composer keys its editor on it, so
   * each hand-off is a fresh editor whose initial draft is this text — the same text handed over
   * twice starts twice.
   */
  composerSeed: ComposerSeed | null;
  /**
   * A transport or request failure. Agent-side failures arrive as `error` wire events and live in
   * the transcript instead.
   */
  failure: string | null;
}

export interface AgentSessionActions {
  /** Loads the server-owned transcript and rejoins a turn that is still running. */
  hydrate: () => Promise<void>;
  /**
   * Replaces the view with a detail the server rebuilt — after a rewind, when the active branch
   * changed and nothing the view held is still true.
   */
  replaceDetail: (detail: AgentSessionDetail) => void;
  seedComposer: (text: string) => void;
  /** Rejects when the request itself fails; stream failures land in `failure`. */
  prompt: (text: string) => Promise<void>;
  /** Runs a server-advertised slash command through its prompt template. */
  command: (name: string, args: string[], text?: string) => Promise<void>;
  approve: (
    toolCallId: string,
    approved: boolean,
    comment?: string
  ) => Promise<void>;
  /** Swaps or partially overrides the catalog — e.g. when the host's locale changes. */
  setLabels: (labels: Partial<AgentLabels> | undefined) => void;
  /** Surfaces a failure from outside the stream (a mutation) in the same place. */
  reportFailure: (message: string) => void;
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
  queryClient: QueryClient;
  sessionId: string;
  kind?: string;
  labels?: Partial<AgentLabels>;
}

/** Shortest gap between two view commits while deltas stream — roughly two frames. */
export const VIEW_FLUSH_MS = 32;

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * The persisted transcript never replays approval events, so the server lists the approval rows
 * separately; they are re-applied here so a reload shows each card as the live stream left it.
 */
export const foldDetail = (detail: AgentSessionDetail): AgentViewState => {
  let view = foldEvents(detail.events);
  for (const approval of detail.approvals) {
    const tool = view.items.find(
      (item) => item.kind === "tool" && item.toolCallId === approval.toolCallId
    );
    // A row for a call that is not on this branch (a rewound session) has nothing to attach to.
    if (tool?.kind !== "tool") continue;
    view = applyEvent(view, {
      type: "approval:request",
      toolCallId: approval.toolCallId,
      toolName: approval.toolName,
      tier: tool.tier,
      args: approval.args ?? tool.args,
    });
    if (approval.status === "pending") continue;
    view = applyEvent(view, {
      type: "approval:resolved",
      toolCallId: approval.toolCallId,
      approved: approval.status === "approved",
      comment: approval.comment,
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
  labels,
  onStateChanged,
  onTurnEnd,
  queryClient,
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
    const detailQuery = sessionDetailQuery(client, scoped);
    const detailKey = agentQueryKeys.session(scoped);

    /** A fresh detail, written to the cache on the way through. */
    const fetchDetail = () =>
      queryClient.fetchQuery({ ...detailQuery, staleTime: 0 });

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    /**
     * Re-syncs the detail after a turn ended with `run:end`, keeping the view the stream built.
     *
     * The step clears its running marker only after the terminal event is flushed, so a `get`
     * issued straight away can still report the finished turn as running; that is retried briefly.
     * If the run genuinely stays running, a queued message started another turn — rejoin it.
     */
    const settle = async (mine: number) => {
      for (let attempt = 0; attempt < 5; attempt++) {
        let detail: AgentSessionDetail;
        try {
          detail = await fetchDetail();
        } catch (cause) {
          if (mine === generation) set({ failure: messageOf(cause) });
          return;
        }
        if (mine !== generation) return;
        if (detail.run?.status !== "running") return;
        await sleep(200 * (attempt + 1));
        if (mine !== generation) return;
      }
      await get().hydrate();
    };

    // Streams that broke before `run:end` since the last clean turn end; backs off and bounds
    // the reconnect — events arriving do not reset it, only a turn that actually finishes does.
    let reconnects = 0;
    const MAX_RECONNECTS = 6;

    /**
     * Runs one turn stream. Rejects only when `start` (the request) fails, so the caller can react
     * — for example put the prompt back into the composer. Everything after that is a state
     * change: events fold into the view, and a mid-stream failure lands in `failure`.
     *
     * When the stream is cancelled by this store (dispose, a newer hydrate or run), the canceller
     * owns what happens next; `run` only re-syncs streams that ended on their own.
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

      // Events fold into a local view first and reach the store at most once per interval: one
      // network chunk decodes into a burst of deltas delivered back-to-back, and every `set` is a
      // synchronous React render, which at that rate trips React's update-depth guard. Only the
      // high-frequency events are throttled; boundaries (user echo, tool/run ends) commit at once.
      let pending: AgentViewState | null = null;
      let echoedUser = false;
      const commitView = () => {
        if (!pending || mine !== generation) return;
        const view = pending;
        const clearPrompt = echoedUser;
        pending = null;
        echoedUser = false;
        set((state) => ({
          view,
          pendingPrompt: clearPrompt ? null : state.pendingPrompt,
        }));
      };
      const throttledCommit = new Throttler(commitView, {
        wait: VIEW_FLUSH_MS,
      });
      const flushView = () => {
        throttledCommit.cancel();
        commitView();
      };

      let ended = false;
      try {
        await consumeStream(
          iterable,
          (event) => {
            if (mine !== generation) return;
            pending = applyEvent(pending ?? get().view, event);
            if (event.type === "user") echoedUser = true;
            if (event.type === "run:end") ended = true;
            if (
              event.type === "assistant:delta" ||
              event.type === "tool:update"
            ) {
              throttledCommit.maybeExecute();
              return;
            }
            flushView();
            if (event.type === "state:changed") {
              // Kind state (a draft, …) rides on the detail; refresh it while the turn is going.
              void queryClient.invalidateQueries({ queryKey: detailKey });
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
        flushView();
        if (controller === own) controller = null;
      }
      if (own.signal.aborted || mine !== generation) return;

      set({ connection: "idle", pendingPrompt: null });
      if (ended) {
        reconnects = 0;
        await settle(mine);
      } else {
        // Broke before `run:end` (connection lost, server restarted): rebuild and rejoin with
        // backoff, and give up after a few rounds rather than reconnecting forever in silence.
        reconnects++;
        if (reconnects > MAX_RECONNECTS) {
          set({ failure: get().labels.connectionLost });
          return;
        }
        await sleep(Math.min(500 * 2 ** (reconnects - 1), 10_000));
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
      labels: mergeLabels(labels),
      view: emptyViewState(),
      connection: "idle",
      pendingPrompt: null,
      composerSeed: null,
      failure: null,

      replaceDetail: (detail) => {
        // Supersedes any stream or re-sync in flight: their view is of a branch that is gone.
        generation++;
        stopStream();
        set({
          view: foldDetail(detail),
          connection: "idle",
          pendingPrompt: null,
          failure: null,
        });
      },

      seedComposer: (text) =>
        set((state) => ({
          composerSeed: { id: (state.composerSeed?.id ?? 0) + 1, text },
        })),

      hydrate: async () => {
        const mine = ++generation;
        stopStream();
        set({ connection: "hydrating" });
        let detail: AgentSessionDetail;
        try {
          detail = await fetchDetail();
        } catch (cause) {
          if (mine === generation) {
            set({ connection: "idle", failure: messageOf(cause) });
          }
          return;
        }
        if (mine !== generation) return;
        set({ view: foldDetail(detail), connection: "idle" });
        if (detail.run?.status === "running") {
          try {
            await attach();
          } catch {
            // Usually the turn finished between `get` and `attach` (NOT_FOUND); the fresh detail
            // says so, and a real transport failure surfaces from that read instead.
            if (mine === generation) {
              await fetchDetail().catch((cause: unknown) => {
                if (mine === generation) set({ failure: messageOf(cause) });
              });
            }
          }
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

      command: async (name, args, displayText) => {
        const text = displayText ?? formatSlashCommand(name, args);
        set({ pendingPrompt: text, failure: null });
        try {
          await run((signal) =>
            client.sessions.chat(
              { ...scoped, action: { type: "command", name, args, text } },
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

      setLabels: (next) => set({ labels: mergeLabels(next) }),

      reportFailure: (message) => set({ failure: message }),

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
// Derived status (store + cached detail)
// ============================================

export type AgentStatus = "awaiting_approval" | "error" | "idle" | "running";

type RunInfo = Pick<AgentSessionDetail, "run"> | undefined;

/** What the session is doing right now, from the live connection first and the server second. */
export const statusOf = (
  state: AgentSessionState,
  detail: RunInfo
): AgentStatus => {
  if (state.connection === "streaming") return "running";
  if (state.view.pendingApprovals.length > 0) return "awaiting_approval";
  if (detail?.run?.status === "running") return "running";
  return state.view.runStatus === "error" ? "error" : "idle";
};

/** A turn is executing (here or elsewhere) — the composer offers Stop instead of Send. */
export const isBusy = (state: AgentSessionState, detail: RunInfo): boolean =>
  state.connection === "streaming" || detail?.run?.status === "running";

export const canPrompt = (state: AgentSessionState, detail: RunInfo): boolean =>
  detail !== undefined &&
  state.connection === "idle" &&
  detail.run?.status !== "running" &&
  state.view.pendingApprovals.length === 0;
