"use client";

import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

interface AgentDockState {
  isOpen: boolean;
  /** The conversation to reopen; validated against the server's list before it is used. */
  sessionId: string | null;
  setOpen: (isOpen: boolean) => void;
  setSessionId: (sessionId: string | null) => void;
}

/**
 * The dock outlives the page, so moving around the workspace neither closes it nor drops the
 * conversation. It belongs to the tab rather than the URL: a link to a draft carries nothing
 * about the agent beside it.
 */
export const agentDockStore = createStore<AgentDockState>()(
  persist(
    (set) => ({
      isOpen: false,
      sessionId: null,
      setOpen: (isOpen) => set({ isOpen }),
      setSessionId: (sessionId) => set({ sessionId }),
    }),
    {
      name: "chia.dash.agent-dock",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      // Rehydrating on mount keeps the server's closed dock and the first client render in step.
      skipHydration: true,
    }
  )
);

export const useAgentDock = <T>(selector: (state: AgentDockState) => T): T =>
  useStore(agentDockStore, selector);
