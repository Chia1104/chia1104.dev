"use client";

import { create } from "zustand";

/** The work the hobby page is showing off: what the stage draws and tints itself with. */
export interface HobbyFocus {
  id: number;
  /** `#rrggbb`, or `null` to keep the idle colour. */
  color: string | null;
  backdropUrl: string | null;
}

/** A work whose page or sheet is open. Its own art is on screen, so the stage only takes its colour. */
export interface HobbyPin {
  /** `#rrggbb`, or `null` to keep the idle colour. */
  color: string | null;
  /** The work's art covers the whole viewport, so nothing of the stage can be seen. */
  coversStage: boolean;
}

interface HobbyStore {
  /** The row under the pointer, the keyboard or the middle of the screen. */
  focus: HobbyFocus | null;
  pinned: HobbyPin | null;
  setFocus: (focus: HobbyFocus | null) => void;
  setPinned: (pinned: HobbyPin | null) => void;
}

/** Shared by the list and a work's page, which name the work, and the stage in the frame. */
export const useHobbyStore = create<HobbyStore>()((set) => ({
  focus: null,
  pinned: null,
  setFocus: (focus) => set({ focus }),
  setPinned: (pinned) => set({ pinned }),
}));
