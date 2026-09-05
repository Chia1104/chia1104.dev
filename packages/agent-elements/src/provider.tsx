"use client";

import type { ReactNode } from "react";
import { createContext, use, useEffect, useMemo, useRef } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "zustand";

import { attachedContext, useAgentContextStore } from "./context.tsx";
import { AgentLabelsProvider } from "./labels-context.tsx";
import type { AgentLabels } from "./labels.ts";
import {
  agentCapabilitiesQuery,
  agentModelsQuery,
  sessionDetailQuery,
} from "./queries.ts";
import type {
  AgentSessionCallbacks,
  AgentSessionStore,
  AgentSessionStoreApi,
} from "./store.ts";
import {
  canPrompt,
  createAgentSessionStore,
  isBusy,
  statusOf,
} from "./store.ts";
import type {
  AgentModelRef,
  AgentSessionClient,
  AgentSessionDetail,
  AgentThinkingLevel,
} from "./types.ts";

/** Host callbacks the provider owns; the store's are passed through, `onForked` is answered here. */
interface AgentProviderCallbacks extends AgentSessionCallbacks {
  /**
   * A fork of this session was created. The host owns which session is mounted, so it decides
   * whether to switch to the new one; its detail is already in the query cache.
   */
  onForked?: (detail: AgentSessionDetail) => void;
}

interface AgentSessionContextValue {
  store: AgentSessionStoreApi;
  client: AgentSessionClient;
  sessionId: string;
  kind: string | undefined;
  callbacks: { current: AgentProviderCallbacks };
}

const AgentSessionContext = createContext<AgentSessionContextValue | undefined>(
  undefined
);

export interface AgentSessionProviderProps extends AgentProviderCallbacks {
  client: AgentSessionClient;
  sessionId: string;
  kind?: string;
  /** Host locale catalog (`@chia/i18n/agent-elements/<locale>.json`), or overrides. */
  labels?: Partial<AgentLabels>;
  children: ReactNode;
}

/**
 * One store per mounted session. Remount with `key={sessionId}` to switch; hydrates on mount and
 * cancels the stream on unmount.
 */
export const AgentSessionProvider = ({
  children,
  client,
  kind,
  labels,
  onForked,
  onStateChanged,
  onTurnEnd,
  sessionId,
}: AgentSessionProviderProps) => {
  const queryClient = useQueryClient();
  const contextStore = useAgentContextStore();
  // Callbacks are read through a ref so a new closure from the host never recreates the store.
  const callbacks = useRef<AgentProviderCallbacks>({});
  callbacks.current = { onForked, onStateChanged, onTurnEnd };

  const storeRef = useRef<AgentSessionStoreApi>(null);
  if (!storeRef.current) {
    storeRef.current = createAgentSessionStore({
      client,
      queryClient,
      sessionId,
      kind,
      labels,
      context: contextStore
        ? () => attachedContext(contextStore.getState())
        : undefined,
      onStateChanged: (event) => callbacks.current.onStateChanged?.(event),
      onTurnEnd: () => callbacks.current.onTurnEnd?.(),
    });
  }
  const store = storeRef.current;

  useEffect(() => {
    void store.getState().hydrate();
    return () => store.getState().dispose();
  }, [store]);

  // A locale switch in the host arrives as a new `labels` value; the store keeps the current one.
  useEffect(() => {
    store.getState().setLabels(labels);
  }, [labels, store]);

  const value = useMemo(
    () => ({ store, client, sessionId, kind, callbacks }),
    [client, kind, sessionId, store]
  );

  // The store keeps its own copy for the messages it writes outside render (`connectionLost`);
  // everything rendered reads the same catalog through the labels context.
  return (
    <AgentSessionContext value={value}>
      <AgentLabelsProvider labels={labels}>{children}</AgentLabelsProvider>
    </AgentSessionContext>
  );
};

const useContextValue = (): AgentSessionContextValue => {
  const value = use(AgentSessionContext);
  if (!value) {
    throw new Error(
      "Agent elements must be rendered within AgentSessionProvider"
    );
  }
  return value;
};

export const useAgentSessionStore = (): AgentSessionStoreApi =>
  useContextValue().store;

export const useAgentSession = <T,>(
  selector: (state: AgentSessionStore) => T
): T => useStore(useAgentSessionStore(), selector);

export const useSessionDetail = () => {
  const { client, kind, sessionId } = useContextValue();
  return useQuery(sessionDetailQuery(client, { sessionId, kind }));
};

export const useAgentModels = () => {
  const { client, kind } = useContextValue();
  const detail = useSessionDetail();
  const sessionKind = kind ?? detail.data?.session.kind;
  return useQuery({
    ...agentModelsQuery(client, sessionKind ?? ""),
    enabled: sessionKind !== undefined,
  });
};

export const useAgentCapabilities = () => {
  const { client, kind } = useContextValue();
  const detail = useSessionDetail();
  const sessionKind = kind ?? detail.data?.session.kind;
  return useQuery({
    ...agentCapabilitiesQuery(client, sessionKind ?? ""),
    enabled: sessionKind !== undefined,
  });
};

export interface UpdateSettingsInput {
  model?: AgentModelRef;
  thinkingLevel?: AgentThinkingLevel;
  autoApprove?: string[];
}

/** Persists settings; the returned detail replaces the cached one. */
export const useUpdateSettings = () => {
  const { client, kind, sessionId, store } = useContextValue();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) =>
      client.sessions["settings:update"]({ sessionId, kind, ...input }),
    onSuccess: (detail) => {
      queryClient.setQueryData(
        sessionDetailQuery(client, { sessionId, kind }).queryKey,
        detail
      );
    },
    onError: (error) => store.getState().reportFailure(error.message),
  });
};

export interface NavigateSessionInput {
  /** Transcript message id; wire ids are entry ids. */
  entryId: string;
  /** Keep a summary of the branch left behind, so the model still knows it happened. */
  summarize?: boolean;
}

/** Replaces both the cached detail and the store view; the old branch is gone. */
export const useNavigateSession = () => {
  const { client, kind, sessionId, store } = useContextValue();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NavigateSessionInput) =>
      client.sessions.navigate({ sessionId, kind, ...input }),
    onSuccess: (detail) => {
      queryClient.setQueryData(
        sessionDetailQuery(client, { sessionId, kind }).queryKey,
        detail
      );
      store.getState().replaceDetail(detail);
    },
    onError: (error) => store.getState().reportFailure(error.message),
  });
};

export interface CompactSessionInput {
  /** Extra focus for the summariser, appended to Pi's compaction prompt. */
  customInstructions?: string;
}

/** Replaces the cached detail and the store view with the compacted branch. */
export const useCompactSession = () => {
  const { client, kind, sessionId, store } = useContextValue();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CompactSessionInput) =>
      client.sessions.compact({ sessionId, kind, ...input }),
    onSuccess: (detail) => {
      queryClient.setQueryData(
        sessionDetailQuery(client, { sessionId, kind }).queryKey,
        detail
      );
      store.getState().replaceDetail(detail);
    },
    onError: (error) => store.getState().reportFailure(error.message),
  });
};

export interface ForkSessionInput {
  /** Fork the whole tree when omitted. */
  entryId?: string;
  /** `before` a user message so it can be re-asked (the default), `at` any entry. */
  position?: "before" | "at";
  title?: string;
}

/**
 * Branches into a new session; this one is untouched. The new detail is cached under its own id
 * and handed to the host's `onForked`, which decides whether to switch to it.
 */
export const useForkSession = () => {
  const { callbacks, client, kind, sessionId, store } = useContextValue();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ForkSessionInput) =>
      client.sessions.fork({ sessionId, kind, ...input }),
    onSuccess: (detail) => {
      queryClient.setQueryData(
        sessionDetailQuery(client, { sessionId: detail.session.id, kind })
          .queryKey,
        detail
      );
      callbacks.current.onForked?.(detail);
    },
    onError: (error) => store.getState().reportFailure(error.message),
  });
};

/** After abort, resyncs the store from the server. */
export const useAbortSession = () => {
  const { client, kind, sessionId, store } = useContextValue();
  return useMutation({
    mutationFn: () => client.sessions.abort({ sessionId, kind }),
    // Whether or not a run was live, the server is the truth now.
    onSuccess: () => store.getState().hydrate(),
    onError: (error) => store.getState().reportFailure(error.message),
  });
};

export const useAgentStatus = () => {
  const detail = useSessionDetail().data;
  return useAgentSession((state) => statusOf(state, detail));
};

export const useAgentBusy = () => {
  const detail = useSessionDetail().data;
  return useAgentSession((state) => isBusy(state, detail));
};

export const useCanPrompt = () => {
  const detail = useSessionDetail().data;
  return useAgentSession((state) => canPrompt(state, detail));
};
