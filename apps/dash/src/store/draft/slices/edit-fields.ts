"use client";

import type { StateCreator } from "zustand";

import { ContentType } from "@chia/db/types";

import type { DraftState } from "../store";

/**
 * Content Data Structure
 * 單個內容類型的數據結構
 */
export interface ContentData {
  content: string;
  source: string;
}

/**
 * Edit Fields Context
 * 編輯字段的上下文數據
 */
export interface EditFieldsContext {
  disabled?: boolean;
  isPending?: boolean;
  content: {
    [ContentType.Tiptap]: ContentData;
    [ContentType.Mdx]: ContentData;
  };
  mode: "edit" | "create";
  token?: string;
  setContent: (content: Partial<EditFieldsContext["content"]>) => void;
}

/**
 * Edit Fields State
 * 管理編輯器字段狀態
 *
 * 遵循 Vercel React 最佳實踐：
 * - rerender-derived-state-no-effect: 狀態在渲染期間衍生
 */
export interface EditFieldsState {
  /**
   * 編輯器內容
   */
  content: EditFieldsContext["content"];

  /**
   * 當前編輯模式
   */
  mode: EditFieldsContext["mode"];

  /**
   * 是否禁用
   */
  disabled: boolean;

  /**
   * 是否處理中
   */
  isPending: boolean;

  // ============ Public Actions ============

  /**
   * 更新內容
   * @param contentType - 內容類型
   * @param data - 內容數據
   */
  updateContent: (
    contentType: typeof ContentType.Tiptap | typeof ContentType.Mdx,
    data: Partial<ContentData>
  ) => void;

  /**
   * 設置所有內容
   * @param content - 完整內容對象
   */
  setContent: (content: Partial<EditFieldsContext["content"]>) => void;

  /**
   * 設置模式
   * @param mode - 編輯模式
   */
  setMode: (mode: EditFieldsContext["mode"]) => void;

  /**
   * 設置禁用狀態
   * @param disabled - 是否禁用
   */
  setDisabled: (disabled: boolean) => void;

  /**
   * 設置處理中狀態
   * @param isPending - 是否處理中
   */
  setIsPending: (isPending: boolean) => void;

  /**
   * 重置編輯字段
   */
  resetEditFields: () => void;

  /**
   * 獲取當前內容
   * @param contentType - 內容類型（可選）
   * @returns 內容數據
   */
  getContent: (
    contentType?: typeof ContentType.Tiptap | typeof ContentType.Mdx
  ) => ContentData;

  // ============ Internal Actions ============

  /**
   * 內部：更新內容字段
   */
  internal_updateContentField: (
    contentType: typeof ContentType.Tiptap | typeof ContentType.Mdx,
    field: keyof ContentData,
    value: string
  ) => void;
}

/**
 * Default Edit Fields State
 */
const DEFAULT_CONTENT: EditFieldsContext["content"] = {
  [ContentType.Mdx]: {
    content: "",
    source: "",
  },
  [ContentType.Tiptap]: {
    content: "",
    source: "",
  },
};

export const createEditFieldsSlice: StateCreator<
  DraftState,
  [["zustand/immer", never], ["zustand/persist", unknown]],
  [],
  EditFieldsState
> = (set, get) => ({
  content: DEFAULT_CONTENT,
  mode: "create",
  disabled: false,
  isPending: false,

  // ============ Public Actions ============

  updateContent: (contentType, data) => {
    set((state) => {
      if (data.content !== undefined) {
        state.content[contentType].content = data.content;
      }
      if (data.source !== undefined) {
        state.content[contentType].source = data.source;
      }
    });
  },

  setContent: (content) => {
    set((state) => {
      if (content[ContentType.Mdx]) {
        state.content[ContentType.Mdx] = {
          ...state.content[ContentType.Mdx],
          ...content[ContentType.Mdx],
        };
      }
      if (content[ContentType.Tiptap]) {
        state.content[ContentType.Tiptap] = {
          ...state.content[ContentType.Tiptap],
          ...content[ContentType.Tiptap],
        };
      }
    });
  },

  setMode: (mode) => {
    set({ mode });
  },

  setDisabled: (disabled) => {
    set({ disabled });
  },

  setIsPending: (isPending) => {
    set({ isPending });
  },

  resetEditFields: () => {
    set({
      content: DEFAULT_CONTENT,
      mode: "create",
      disabled: false,
      isPending: false,
    });
  },

  getContent: (contentType) => {
    const state = get();
    if (contentType) {
      return state.content[contentType];
    }
    // 默認返回 Mdx 內容
    return state.content[ContentType.Mdx];
  },

  // ============ Internal Actions ============

  internal_updateContentField: (contentType, field, value) => {
    set((state) => {
      state.content[contentType][field] = value;
    });
  },
});
