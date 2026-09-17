import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

import type { DraftPatch } from "./draft-values";

/**
 * Edits the server has not acknowledged: the fields that moved, and what each held when it was
 * edited, which is what lets them be carried onto whatever the draft holds when they come back.
 */
export interface DraftSnapshot {
  patch: DraftPatch;
  seen: DraftPatch;
}

interface DraftSnapshotEntry extends DraftSnapshot {
  draftId: number;
}

interface DraftSnapshotState {
  entries: DraftSnapshotEntry[];
  keep: (draftId: number, snapshot: DraftSnapshot) => void;
  drop: (draftId: number) => void;
}

/**
 * Browser-local copy of what the editor has not synced yet. It survives a closed tab or a lost
 * connection; the form stays the owner of the values and the server the owner of the revision.
 */
export const draftSnapshotStore = createStore<DraftSnapshotState>()(
  persist(
    (set) => ({
      entries: [],
      keep: (draftId, snapshot) =>
        set((state) => ({
          entries: [
            ...state.entries.filter((entry) => entry.draftId !== draftId),
            { draftId, ...snapshot },
          ],
        })),
      drop: (draftId) =>
        set((state) =>
          state.entries.some((entry) => entry.draftId === draftId)
            ? {
                entries: state.entries.filter(
                  (entry) => entry.draftId !== draftId
                ),
              }
            : state
        ),
    }),
    {
      name: "chia.dash.draft-snapshots",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ entries: state.entries }),
      // Snapshots are short-lived; ones written under another schema are discarded, not converted.
      migrate: () => ({ entries: [] }),
    }
  )
);

export const readDraftSnapshot = (draftId: number): DraftSnapshot | null => {
  const entry = draftSnapshotStore
    .getState()
    .entries.find((candidate) => candidate.draftId === draftId);
  return entry ? { patch: entry.patch, seen: entry.seen } : null;
};
