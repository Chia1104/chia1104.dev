"use client";

import type { ReactNode } from "react";
import { createContext, use, useEffect, useMemo, useRef } from "react";

import { useStore } from "zustand";

import type { AgentLabels } from "./labels.ts";
import { defaultAgentLabels } from "./labels.ts";
import type {
  AgentSessionCallbacks,
  AgentSessionStore,
  AgentSessionStoreApi,
} from "./store.ts";
import { createAgentSessionStore } from "./store.ts";
import type { AgentSessionClient } from "./types.ts";

const AgentSessionContext = createContext<AgentSessionStoreApi | undefined>(
  undefined
);

const AgentLabelsContext = createContext<AgentLabels>(defaultAgentLabels);

export interface AgentSessionProviderProps extends AgentSessionCallbacks {
  client: AgentSessionClient;
  sessionId: string;
  kind?: string;
  labels?: Partial<AgentLabels>;
  children: ReactNode;
}

/**
 * One store per mounted session. Remount with `key={sessionId}` to switch sessions — the store
 * hydrates on mount and cancels its stream on unmount.
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
  // Callbacks are read through a ref so a new closure from the host never recreates the store.
  const callbacks = useRef<AgentSessionCallbacks>({});
  callbacks.current = { onStateChanged, onTurnEnd };

  const storeRef = useRef<AgentSessionStoreApi>(null);
  if (!storeRef.current) {
    storeRef.current = createAgentSessionStore({
      client,
      sessionId,
      kind,
      onStateChanged: (event) => callbacks.current.onStateChanged?.(event),
      onTurnEnd: () => callbacks.current.onTurnEnd?.(),
    });
  }
  const store = storeRef.current;

  useEffect(() => {
    void store.getState().hydrate();
    return () => store.getState().dispose();
  }, [store]);

  const mergedLabels = useMemo(
    () => ({ ...defaultAgentLabels, ...labels }),
    [labels]
  );

  return (
    <AgentSessionContext value={store}>
      <AgentLabelsContext value={mergedLabels}>{children}</AgentLabelsContext>
    </AgentSessionContext>
  );
};

export const useAgentSessionStore = (): AgentSessionStoreApi => {
  const store = use(AgentSessionContext);
  if (!store) {
    throw new Error(
      "useAgentSessionStore must be used within AgentSessionProvider"
    );
  }
  return store;
};

export const useAgentSession = <T,>(
  selector: (state: AgentSessionStore) => T
): T => useStore(useAgentSessionStore(), selector);

export const useAgentLabels = (): AgentLabels => use(AgentLabelsContext);
