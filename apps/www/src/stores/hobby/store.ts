"use client";

import { create } from "zustand";

/** The work the hobby page is showing off: what the stage draws and tints itself with. */
export interface HobbyFocus {
  id: number;
  /** `#rrggbb`, or `null` to keep the idle colour. */
  color: string | null;
  backdropUrl: string | null;
}

/** What the stage does while a page or sheet has pinned it. */
export const HobbyPinStage = {
  /** Draws the pin's key art and keeps moving: the page shows no art of its own. */
  Live: "live",
  /** Holds its frame: the work's own art is on screen, or the stage has scrolled out of view. */
  Held: "held",
  /** Not mounted: the work's art covers the whole viewport. */
  Covered: "covered",
} as const;

export type HobbyPinStage = (typeof HobbyPinStage)[keyof typeof HobbyPinStage];

/** A page or sheet about one work, which the stage follows instead of the row in focus. */
export interface HobbyPin {
  /** `#rrggbb`, or `null` to keep the idle colour. */
  color: string | null;
  /** Key art for the stage to draw; `null` leaves whatever it was drawing. */
  backdropUrl: string | null;
  stage: HobbyPinStage;
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
