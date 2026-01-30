"use client";

import type { StateCreator } from "zustand";

import type { feedsContracts } from "@chia/api/orpc/contracts";
import { Locale } from "@chia/db/types";

import type { DraftState } from "../store";

import type { FormSchema } from "./edit-fields";

/**
 * Draft Data Structure
 * 單個草稿的數據結構
 */
export interface DraftData {
  token: string;
  formData: Partial<FormSchema>;
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
   * 創建草稿
   * @param token - 草稿標識
   * @param formData - 表單數據
   */
  createDraft: (
    token: string,
    formData: Partial<feedsContracts.CreateFeedInput>
  ) => void;

  /**
   * 保存草稿
   * @param token - 草稿標識
   * @param formData - 表單數據
   * @param content - 編輯器內容
   */
  saveDraft: (
    token: string,
    formData: Partial<feedsContracts.CreateFeedInput>
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

  internal_createEmptyContent: () => FormSchema["translations"][Locale];
}
export const createDraftsSlice: StateCreator<
  DraftState,
  [["zustand/immer", never], ["zustand/persist", unknown]],
  [],
  DraftsState
> = (set, get) => ({
  draftsMap: {},

  // ============ Public Actions ============

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
