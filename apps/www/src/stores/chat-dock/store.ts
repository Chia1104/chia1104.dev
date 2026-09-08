"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { DockMode } from "@chia/ui/dock";

interface ChatDockStore {
  mode: DockMode;
  setMode: (mode: DockMode) => void;
  toggle: () => void;
}

/**
 * Whether the chat is open belongs to the tab, not the URL: reading a post keeps the conversation
 * beside it, and a sign-in round trip comes back to it. A new visit starts closed. The width is
 * the shell's own, kept across tabs.
 */
export const useChatDockStore = create<ChatDockStore>()(
  persist(
    (set) => ({
      mode: "closed",
      setMode: (mode) => set({ mode }),
      toggle: () =>
        set((state) => ({ mode: state.mode === "closed" ? "open" : "closed" })),
    }),
    {
      name: "CHAT_DOCK_STORE",
      version: 2,
      // Earlier shapes are dropped; the chat starts closed.
      migrate: () => ({}),
      storage: createJSONStorage(() => sessionStorage),
      // Rehydrating on mount keeps the server's closed chat and the first client render in step.
      skipHydration: true,
    }
  )
);
