"use client";

import type { StateCreator } from "zustand";

import type { feedsContracts } from "@chia/api/orpc/contracts";

import type { DraftState } from "../store";

import type { EditFieldsContext } from "./edit-fields";

/**
 * Draft Data Structure
 * 單個草稿的數據結構
 */
export interface DraftData {
  token: string;
  formData: Partial<feedsContracts.CreateFeedInput>;
  content: EditFieldsContext["content"];
  updatedAt: number;
}

/**
 * Drafts State
 * 管理多個草稿的狀態
 */
export interface DraftsState {
  /**
   * 草稿映射表
   * key: token, value: DraftData
   */
  draftsMap: Record<string, DraftData>;

  // ============ Public Actions ============

  /**
   * 保存草稿
   * @param token - 草稿標識
   * @param formData - 表單數據
   * @param content - 編輯器內容
   */
  saveDraft: (
    token: string,
    formData: Partial<feedsContracts.CreateFeedInput>,
    content?: EditFieldsContext["content"]
  ) => void;

  /**
   * 加載草稿
   * @param token - 草稿標識
   * @returns 草稿數據或 undefined
   */
  loadDraft: (token: string) => DraftData | undefined;

  /**
   * 刪除草稿
   * @param token - 草稿標識
   */
  deleteDraft: (token: string) => void;

  /**
   * 獲取所有草稿
   * @returns 草稿數組
   */
  getAllDrafts: () => DraftData[];

  /**
   * 清除所有草稿
   */
  clearAllDrafts: () => void;

  // ============ Internal Actions ============

  /**
   * 內部：分發草稿更新
   * @param token - 草稿標識
   * @param draft - 草稿數據
   */
  internal_dispatchDraft: (token: string, draft: DraftData) => void;

  /**
   * 內部：移除草稿
   * @param token - 草稿標識
   */
  internal_removeDraft: (token: string) => void;
}
export const createDraftsSlice: StateCreator<
  DraftState,
  [["zustand/immer", never], ["zustand/persist", unknown]],
  [],
  DraftsState
> = (set, get) => ({
  draftsMap: {},

  // ============ Public Actions ============

  saveDraft: (token, formData, content) => {
    const currentDraft = get().draftsMap[token];
    const draft: DraftData = {
      token,
      formData,
      content: content ?? currentDraft?.content ?? get().content,
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

  // ============ Internal Actions ============

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
});
