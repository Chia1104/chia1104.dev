"use client";

import { useStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

import type { DockMode } from "@chia/ui/dock";

interface AgentDockState {
  mode: DockMode;
  /** The conversation to reopen; validated against the server's list before it is used. */
  sessionId: string | null;
  setMode: (mode: DockMode) => void;
  toggle: () => void;
  setSessionId: (sessionId: string | null) => void;
}

/**
 * The dock outlives the page, so moving around the workspace neither closes it nor drops the
 * conversation. It belongs to the tab rather than the URL: a link to a draft carries nothing
 * about the agent beside it. The width is the shell's own, kept across tabs.
 */
export const agentDockStore = createStore<AgentDockState>()(
  persist(
    (set) => ({
      mode: "closed",
      sessionId: null,
      setMode: (mode) => set({ mode }),
      toggle: () =>
        set((state) => ({ mode: state.mode === "closed" ? "open" : "closed" })),
      setSessionId: (sessionId) => set({ sessionId }),
    }),
    {
      name: "chia.dash.agent-dock",
      version: 2,
      // Earlier shapes are dropped; the dock starts closed.
      migrate: () => ({}),
      storage: createJSONStorage(() => sessionStorage),
      // Rehydrating on mount keeps the server's closed dock and the first client render in step.
      skipHydration: true,
    }
  )
);

export const useAgentDock = <T>(selector: (state: AgentDockState) => T): T =>
  useStore(agentDockStore, selector);
