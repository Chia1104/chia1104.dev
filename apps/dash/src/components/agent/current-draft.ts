"use client";

import { useSyncExternalStore } from "react";

/** The draft open in the editor, offered to the agent drawer as an attachment. */
export interface CurrentDraft {
  id: number;
  title: string | null;
  feedId: number | null;
}

let current: CurrentDraft | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Set by the editor while it is mounted; the drawer lives in the layout, outside its tree. */
export const setCurrentDraft = (draft: CurrentDraft | null) => {
  current = draft;
  for (const listener of listeners) listener();
};

export const useCurrentDraft = (): CurrentDraft | null =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  );
