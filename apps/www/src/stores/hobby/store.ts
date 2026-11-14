"use client";

import { create } from "zustand";

/** The work the hobby page is showing off: what the stage draws and tints itself with. */
export interface HobbyFocus {
  id: number;
  /** `#rrggbb`, or `null` to keep the idle colour. */
  color: string | null;
  backdropUrl: string | null;
}

interface HobbyStore {
  focus: HobbyFocus | null;
  setFocus: (focus: HobbyFocus | null) => void;
}

/** Shared by the list, which names the work in focus, and the stage, which lives in the frame. */
export const useHobbyStore = create<HobbyStore>()((set) => ({
  focus: null,
  setFocus: (focus) => set({ focus }),
}));
