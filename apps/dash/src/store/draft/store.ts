"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import type { DraftsState } from "./slices/drafts";
import { createDraftsSlice } from "./slices/drafts";
import type { EditFieldsState } from "./slices/edit-fields";
import { createEditFieldsSlice } from "./slices/edit-fields";

export interface DraftState extends DraftsState, EditFieldsState {}

/**
 * Draft Store
 * 統一管理草稿和編輯字段狀態
 *
 * 架構：
 * - draftsSlice: 管理多個草稿（基於 token）
 * - editFieldsSlice: 管理編輯器狀態
 */
export type DraftStore = ReturnType<typeof createDraftStore>;

const createDraftStore = () => {
  return create<DraftState>()(
    persist(
      immer((...args) => ({
        ...createDraftsSlice(...args),
        ...createEditFieldsSlice(...args),
      })),
      {
        name: "DRAFT_STORE",
        partialize: (state) => ({
          draftsMap: state.draftsMap,
        }),
      }
    )
  );
};

export const useDraftStore = createDraftStore();

export type { DraftData } from "./slices/drafts";
export type { ContentData, EditFieldsContext } from "./slices/edit-fields";
