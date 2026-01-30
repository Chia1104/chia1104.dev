"use client";

import * as z from "zod";
import type { StateCreator } from "zustand";

import { feedsContracts } from "@chia/api/orpc/contracts";
import { Locale } from "@chia/db/types";

import type { DraftState } from "../store";

export type FormSchema = feedsContracts.CreateFeedInput & {
  activeLocale: Locale;
};

export const formSchema = z.object({
  ...feedsContracts.createFeedSchema.shape,
  activeLocale: z.enum(Locale),
});

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
  mode: "edit" | "create";
  activeLocale: Locale;
  token?: string;
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
   * 當前編輯模式
   */
  mode: EditFieldsContext["mode"];

  /**
   * 當前語系
   */
  activeLocale: Locale;

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
   * 設置模式
   * @param mode - 編輯模式
   */
  setMode: (mode: EditFieldsContext["mode"]) => void;

  /**
   * 設置語系
   * @param locale - 當前語系
   */
  setActiveLocale: (locale: Locale) => void;

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
}

export const createEditFieldsSlice: StateCreator<
  DraftState,
  [["zustand/immer", never], ["zustand/persist", unknown]],
  [],
  EditFieldsState
> = (set) => ({
  mode: "create",
  activeLocale: Locale.zhTW,
  disabled: false,
  isPending: false,

  // ============ Public Actions ============

  setMode: (mode) => {
    set({ mode });
  },

  setActiveLocale: (locale) => {
    set({ activeLocale: locale });
  },

  setDisabled: (disabled) => {
    set({ disabled });
  },

  setIsPending: (isPending) => {
    set({ isPending });
  },

  resetEditFields: () => {
    set({
      mode: "create",
      disabled: false,
      isPending: false,
    });
  },
});
