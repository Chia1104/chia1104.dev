"use client";

import type { StateCreator } from "zustand";

import type { feedsContracts } from "@chia/api/orpc/contracts";
import { Locale } from "@chia/db/types";

import type { DraftState } from "../store";

import type { FormSchema } from "./edit-fields";

export interface DraftData {
  token: string;
  formData: Partial<FormSchema>;
  updatedAt: number;
}

export interface DraftsState {
  /** Keyed by draft token. */
  draftsMap: Record<string, DraftData>;

  createDraft: (
    token: string,
    formData: Partial<feedsContracts.CreateFeedInput>
  ) => void;

  saveDraft: (
    token: string,
    formData: Partial<feedsContracts.CreateFeedInput>
  ) => void;

  loadDraft: (token: string) => DraftData | undefined;

  deleteDraft: (token: string) => void;

  getAllDrafts: () => DraftData[];

  clearAllDrafts: () => void;

  internal_dispatchDraft: (token: string, draft: DraftData) => void;

  internal_removeDraft: (token: string) => void;

  internal_createEmptyContent: () => FormSchema["translations"][Locale];
}
export const createDraftsSlice: StateCreator<
  DraftState,
  [["zustand/immer", never], ["zustand/persist", unknown]],
  [],
  DraftsState
> = (set, get) => ({
  draftsMap: {},

  createDraft: (token, formData) => {
    const draft: DraftData = {
      token,
      formData: {
        ...formData,
        translations: {
          [Locale.zhTW]: get().internal_createEmptyContent(),
          [Locale.En]: get().internal_createEmptyContent(),
        },
      },
      updatedAt: Date.now(),
    };

    get().internal_dispatchDraft(token, draft);
  },

  saveDraft: (token, formData) => {
    const draft: DraftData = {
      token,
      formData,
      updatedAt: Date.now(),
    };

    get().internal_dispatchDraft(token, draft);
  },

  loadDraft: (token) => {
    return get().draftsMap[token];
  },

  deleteDraft: (token) => {
    get().internal_removeDraft(token);
  },

  getAllDrafts: () => {
    return Object.values(get().draftsMap).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  },

  clearAllDrafts: () => {
    set((state) => {
      state.draftsMap = {};
    });
  },

  internal_dispatchDraft: (token, draft) => {
    set((state) => {
      state.draftsMap[token] = draft;
    });
  },

  internal_removeDraft: (token) => {
    set((state) => {
      delete state.draftsMap[token];
    });
  },

  internal_createEmptyContent: () => {
    return {
      title: "Untitled",
      excerpt: null,
      description: null,
      summary: null,
      readTime: null,
      content: {
        content: "",
        source: "",
        unstableSerializedSource: null,
      },
    };
  },
});
