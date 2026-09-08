"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface ChatDockStore {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}

/**
 * Whether the chat is open belongs to the tab, not the URL: reading a post keeps the conversation
 * beside it, and a sign-in round trip comes back to it. A new visit starts closed.
 */
export const useChatDockStore = create<ChatDockStore>()(
  persist(
    (set) => ({
      isOpen: false,
      setOpen: (isOpen) => set({ isOpen }),
    }),
    {
      name: "CHAT_DOCK_STORE",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      // Rehydrating on mount keeps the server's closed chat and the first client render in step.
      skipHydration: true,
    }
  )
);
