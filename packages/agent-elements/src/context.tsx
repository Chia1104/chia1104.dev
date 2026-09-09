"use client";

import type { ReactNode } from "react";
import { createContext, use, useEffect, useRef } from "react";

import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import type { AgentAttachmentInput } from "@chia/agent-runtime/wire/schema";

import { attachmentInputOf, attachmentKeyOf } from "./attachment.ts";

/**
 * Records the host has on screen for the agent: what a prompt attaches, plus a name to show.
 * A page provides them while mounted; every prompt, suggestion and slash command sent from a
 * session under the same provider carries the ones the operator has not detached.
 */
export type AgentContextItem = AgentAttachmentInput & {
  label: string;
  /** Withdrawn once a prompt has carried it: a selection is a one-off, not a standing record. */
  once?: boolean;
};

/**
 * A prompt asked for from outside the session, e.g. a selection menu on the page. The session
 * mounted under the same provider sends it as soon as it can take a prompt.
 */
export interface AgentContextRequest {
  text: string;
  attachments?: readonly AgentAttachmentInput[];
}

export interface AgentContextState {
  items: readonly AgentContextItem[];
  /** Keys the operator detached. Withdrawing an item forgets its key, so it comes back attached. */
  detached: readonly string[];
  pending: AgentContextRequest | null;
  provide: (item: AgentContextItem) => void;
  withdraw: (key: string) => void;
  setAttached: (key: string, attached: boolean) => void;
  request: (request: AgentContextRequest) => void;
  /** Claims the pending request; the caller is now responsible for sending it. */
  takeRequest: () => AgentContextRequest | null;
  /** A prompt carried the attached items; the one-off ones are done. */
  sent: () => void;
}

export const createAgentContextStore = () =>
  createStore<AgentContextState>()((set, get) => ({
    items: [],
    detached: [],
    pending: null,
    provide: (item) =>
      set((state) => {
        const key = attachmentKeyOf(item);
        const index = state.items.findIndex(
          (current) => attachmentKeyOf(current) === key
        );
        if (index < 0) return { items: [...state.items, item] };
        const items = [...state.items];
        items[index] = item;
        return { items };
      }),
    withdraw: (key) =>
      set((state) => ({
        items: state.items.filter(
          (current) => attachmentKeyOf(current) !== key
        ),
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
    request: (request) => set({ pending: request }),
    takeRequest: () => {
      const { pending } = get();
      if (pending) set({ pending: null });
      return pending;
    },
    sent: () =>
      set((state) => {
        const gone = new Set(
          state.items
            .filter(
              (item) =>
                item.once && !state.detached.includes(attachmentKeyOf(item))
            )
            .map(attachmentKeyOf)
        );
        if (gone.size === 0) return state;
        return {
          items: state.items.filter((item) => !gone.has(attachmentKeyOf(item))),
        };
      }),
  }));

export type AgentContextStoreApi = ReturnType<typeof createAgentContextStore>;

/** What the next prompt carries: every provided item the operator has not detached. */
export const attachedContext = (
  state: AgentContextState
): AgentAttachmentInput[] =>
  state.items
    .filter((item) => !state.detached.includes(attachmentKeyOf(item)))
    .map(attachmentInputOf);

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
  const key = item ? attachmentKeyOf(item) : null;
  const label = item?.label;
  const itemRef = useRef(item);
  itemRef.current = item;

  useEffect(() => {
    const current = itemRef.current;
    if (key === null || label === undefined || !current) return;
    store.getState().provide(current);
  }, [key, label, store]);

  useEffect(() => {
    if (key === null) return;
    return () => store.getState().withdraw(key);
  }, [key, store]);
};
