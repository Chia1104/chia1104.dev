"use client";

import type { ReactNode } from "react";
import { createContext, use, useEffect, useMemo, useRef } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "zustand";

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
  AgentThinkingLevel,
} from "./types.ts";

interface AgentSessionContextValue {
  store: AgentSessionStoreApi;
  client: AgentSessionClient;
  sessionId: string;
  kind: string | undefined;
}

const AgentSessionContext = createContext<AgentSessionContextValue | undefined>(
  undefined
);

export interface AgentSessionProviderProps extends AgentSessionCallbacks {
  client: AgentSessionClient;
  sessionId: string;
  kind?: string;
  /** The catalog for the host's locale (`@chia/i18n/agent-elements/<locale>.json`), or overrides. */
  labels?: Partial<AgentLabels>;
  children: ReactNode;
}

/**
 * One store per mounted session, over the host's `QueryClient`. Remount with `key={sessionId}` to
 * switch sessions — the store hydrates on mount and cancels its stream on unmount.
 */
export const AgentSessionProvider = ({
  children,
  client,
  kind,
  labels,
  onStateChanged,
  onTurnEnd,
  sessionId,
}: AgentSessionProviderProps) => {
  const queryClient = useQueryClient();
  // Callbacks are read through a ref so a new closure from the host never recreates the store.
  const callbacks = useRef<AgentSessionCallbacks>({});
  callbacks.current = { onStateChanged, onTurnEnd };

  const storeRef = useRef<AgentSessionStoreApi>(null);
  if (!storeRef.current) {
    storeRef.current = createAgentSessionStore({
      client,
      queryClient,
      sessionId,
      kind,
      labels,
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
    () => ({ store, client, sessionId, kind }),
    [client, kind, sessionId, store]
  );

  return <AgentSessionContext value={value}>{children}</AgentSessionContext>;
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

/** Live state: the folded transcript, connection and stream actions. */
export const useAgentSession = <T,>(
  selector: (state: AgentSessionStore) => T
): T => useStore(useAgentSessionStore(), selector);

export const useAgentLabels = (): AgentLabels =>
  useAgentSession((state) => state.labels);

// ============================================
// Server state (TanStack Query)
// ============================================

/** The session detail as the store last fetched it — settings, run, stats and kind state. */
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

/** Persists session settings; the returned detail replaces the cached one. */
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

/** Stops the running turn server-side, then resyncs the store from the server. */
export const useAbortSession = () => {
  const { client, kind, sessionId, store } = useContextValue();
  return useMutation({
    mutationFn: () => client.sessions.abort({ sessionId, kind }),
    // Whether or not a run was live, the server is the truth now.
    onSuccess: () => store.getState().hydrate(),
    onError: (error) => store.getState().reportFailure(error.message),
  });
};

// ============================================
// Derived
// ============================================

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
