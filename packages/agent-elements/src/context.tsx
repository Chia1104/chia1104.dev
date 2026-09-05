"use client";

import type { ReactNode } from "react";
import { createContext, use, useEffect, useRef } from "react";

import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import type { AgentAttachmentInput } from "./store.ts";

/**
 * Records the host has on screen for the agent: what a prompt attaches, plus a name to show.
 * A page provides them while mounted; every prompt, suggestion and slash command sent from a
 * session under the same provider carries the ones the operator has not detached.
 */
export interface AgentContextItem extends AgentAttachmentInput {
  label: string;
}

export interface AgentContextState {
  items: readonly AgentContextItem[];
  /** Keys the operator detached. Withdrawing an item forgets its key, so it comes back attached. */
  detached: readonly string[];
  provide: (item: AgentContextItem) => void;
  withdraw: (key: string) => void;
  setAttached: (key: string, attached: boolean) => void;
}

export const contextKeyOf = (item: AgentAttachmentInput): string =>
  `${item.type}:${item.id}`;

export const createAgentContextStore = () =>
  createStore<AgentContextState>()((set) => ({
    items: [],
    detached: [],
    provide: (item) =>
      set((state) => {
        const key = contextKeyOf(item);
        const index = state.items.findIndex(
          (current) => contextKeyOf(current) === key
        );
        if (index < 0) return { items: [...state.items, item] };
        const items = [...state.items];
        items[index] = item;
        return { items };
      }),
    withdraw: (key) =>
      set((state) => ({
        items: state.items.filter((current) => contextKeyOf(current) !== key),
        detached: state.detached.filter((current) => current !== key),
      })),
    setAttached: (key, attached) =>
      set((state) => ({
        detached: attached
          ? state.detached.filter((current) => current !== key)
          : state.detached.includes(key)
            ? state.detached
            : [...state.detached, key],
      })),
  }));

export type AgentContextStoreApi = ReturnType<typeof createAgentContextStore>;

/** What the next prompt carries: every provided item the operator has not detached. */
export const attachedContext = (
  state: AgentContextState
): AgentAttachmentInput[] =>
  state.items
    .filter((item) => !state.detached.includes(contextKeyOf(item)))
    .map(({ id, type }) => ({ type, id }));

const AgentContextStoreContext = createContext<AgentContextStoreApi | null>(
  null
);

/** Mount above both the pages that provide context and the session that sends it. */
export const AgentContextProvider = ({ children }: { children: ReactNode }) => {
  const storeRef = useRef<AgentContextStoreApi>(null);
  if (!storeRef.current) storeRef.current = createAgentContextStore();
  return (
    <AgentContextStoreContext value={storeRef.current}>
      {children}
    </AgentContextStoreContext>
  );
};

/** `null` outside a provider: a session mounted without one sends no context. */
export const useAgentContextStore = (): AgentContextStoreApi | null =>
  use(AgentContextStoreContext);

const useRequiredAgentContextStore = (): AgentContextStoreApi => {
  const store = use(AgentContextStoreContext);
  if (!store) {
    throw new Error(
      "Agent context must be rendered within AgentContextProvider"
    );
  }
  return store;
};

export const useAgentContext = <T,>(
  selector: (state: AgentContextState) => T
): T => useStore(useRequiredAgentContextStore(), selector);

/**
 * Provides `item` for as long as the caller is mounted. A new label updates the item in place
 * and keeps the operator's attach decision; a new record replaces it and starts attached.
 */
export const useProvideAgentContext = (item: AgentContextItem | null) => {
  const store = useRequiredAgentContextStore();
  const key = item ? contextKeyOf(item) : null;
  const type = item?.type;
  const id = item?.id;
  const label = item?.label;

  useEffect(() => {
    if (type === undefined || id === undefined || label === undefined) return;
    store.getState().provide({ type, id, label });
  }, [id, label, store, type]);

  useEffect(() => {
    if (key === null) return;
    return () => store.getState().withdraw(key);
  }, [key, store]);
};
