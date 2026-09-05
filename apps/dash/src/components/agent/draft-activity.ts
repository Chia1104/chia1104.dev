"use client";

import * as z from "zod";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import type { AgentToolEvent } from "@chia/agent-elements/store";

/** One draft-tier tool call the mounted session has in flight. */
export interface DraftActivity {
  draftId: number;
  locale?: string;
  label: string;
}

interface DraftActivityState {
  running: ReadonlyMap<string, DraftActivity>;
  begin: (toolCallId: string, activity: DraftActivity) => void;
  end: (toolCallId: string) => DraftActivity | undefined;
  clear: () => void;
}

/**
 * What the writing agent is doing to the drafts on screen, fed from the mounted session's tool
 * events. The editor sits outside the session provider, so this bridges the two; `draft:watch`
 * remains the authority on the row itself.
 */
export const draftActivityStore = createStore<DraftActivityState>()(
  (set, get) => ({
    running: new Map(),
    begin: (toolCallId, activity) =>
      set((state) => {
        const running = new Map(state.running);
        running.set(toolCallId, activity);
        return { running };
      }),
    end: (toolCallId) => {
      const current = get().running.get(toolCallId);
      if (!current) return undefined;
      set((state) => {
        const running = new Map(state.running);
        running.delete(toolCallId);
        return { running };
      });
      return current;
    },
    clear: () => set({ running: new Map() }),
  })
);

const draftArgs = z.object({
  draftId: z.number().int(),
  locale: z.string().optional(),
});

/** Every draft tool echoes the revision it left the draft at. */
const draftDetails = z.object({ revision: z.number().int() });

export interface SettledDraftCall extends DraftActivity {
  /** Absent when the tool did not report one; the caller then refreshes unconditionally. */
  revision?: number;
}

/**
 * Records a draft-tier call by its `draftId` argument and returns the call when it settles with
 * a result. Attaching to a running turn replays settled calls, so the caller compares the
 * revision with what it already has before refreshing.
 */
export const trackDraftToolEvent = (
  event: AgentToolEvent
): SettledDraftCall | null => {
  const { begin, end } = draftActivityStore.getState();
  if (event.type === "tool:start") {
    if (event.tier !== "draft") return null;
    const args = draftArgs.safeParse(event.args);
    if (args.success) {
      begin(event.toolCallId, { label: event.label, ...args.data });
    }
    return null;
  }
  const settled = end(event.toolCallId);
  if (!settled || event.isError || event.aborted) return null;
  const details = draftDetails.safeParse(event.details);
  return details.success ? { ...settled, ...details.data } : settled;
};

export const useDraftActivity = (draftId: number): DraftActivity | null =>
  useStore(draftActivityStore, (state) => {
    for (const activity of state.running.values()) {
      if (activity.draftId === draftId) return activity;
    }
    return null;
  });
