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

/**
 * Records a draft-tier call by its `draftId` argument and returns the activity when the call
 * settles with a result, so the caller can refresh that draft at once.
 */
export const trackDraftToolEvent = (
  event: AgentToolEvent
): DraftActivity | null => {
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
  return settled && !event.isError && !event.aborted ? settled : null;
};

export const useDraftActivity = (draftId: number): DraftActivity | null =>
  useStore(draftActivityStore, (state) => {
    for (const activity of state.running.values()) {
      if (activity.draftId === draftId) return activity;
    }
    return null;
  });
