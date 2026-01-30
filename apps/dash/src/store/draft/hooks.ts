"use client";

import { useCallback } from "react";

import { useShallow } from "zustand/react/shallow";

import type { feedsContracts } from "@chia/api/orpc/contracts";

import { useDraft as useDraftStore } from "./store";
import type { DraftData } from "./store";

/**
 * useDraft Hook
 * 管理單個草稿的便捷 hook
 *
 * @param token - 草稿標識
 * @returns 草稿操作方法
 *
 * @example
 * ```tsx
 * const { draft, saveDraft, deleteDraft } = useDraft(token);
 *
 * // 保存草稿
 * saveDraft(formData);
 *
 * // 刪除草稿
 * deleteDraft();
 * ```
 */
export const useDraft = (token: string) => {
  const store = useDraftStore(
    useShallow((state) => ({
      draftsMap: state.draftsMap,
      saveDraft: state.saveDraft,
      loadDraft: state.loadDraft,
      deleteDraft: state.deleteDraft,
      createDraft: state.createDraft,
    }))
  );

  const draft = store.draftsMap[token];

  const createDraft = useCallback(
    (formData: Partial<feedsContracts.CreateFeedInput>) => {
      store.createDraft(token, formData);
    },
    [token, store]
  );

  const saveDraft = useCallback(
    (formData: Partial<feedsContracts.CreateFeedInput>) => {
      store.saveDraft(token, formData);
    },
    [token, store]
  );

  const deleteDraft = useCallback(() => {
    store.deleteDraft(token);
  }, [token, store]);

  const getState = useCallback(
    () => ({
      draft: store.loadDraft(token),
    }),
    [token, store]
  );

  const setState = useCallback(
    (data: { draft?: Partial<feedsContracts.CreateFeedInput> }) => {
      if (data.draft) {
        store.saveDraft(token, data.draft);
      }
    },
    [token, store]
  );

  return {
    /**
     * 當前草稿數據（衍生狀態）
     */
    draft,

    /**
     * 創建草稿
     */
    createDraft,

    /**
     * 保存草稿
     */
    saveDraft,

    /**
     * 刪除草稿
     */
    deleteDraft,

    /**
     * 獲取草稿狀態
     */
    getState,

    /**
     * 設置草稿狀態
     */
    setState,
  };
};

/**
 * useAllDrafts Hook
 * 獲取所有草稿
 *
 * @returns 草稿數組
 *
 * @example
 * ```tsx
 * const drafts = useAllDrafts();
 *
 * drafts.forEach(draft => {
 *   console.log(draft.token, draft.formData);
 * });
 * ```
 */
export const useAllDrafts = (): DraftData[] => {
  const draftsMap = useDraftStore(useShallow((state) => state.draftsMap));

  return Object.values(draftsMap);
};

/**
 * useEditFields Hook
 * 管理編輯字段的便捷 hook
 *
 * @returns 編輯字段操作方法
 *
 * @example
 * ```tsx
 * const { content, updateContent, mode, setMode } = useEditFields();
 *
 * // 更新內容
 * updateContent(ContentType.Mdx, { content: "new content" });
 *
 * // 切換模式
 * setMode("edit");
 * ```
 */
export const useEditFields = () => {
  return useDraftStore(
    useShallow((state) => ({
      mode: state.mode,
      activeLocale: state.activeLocale,
      disabled: state.disabled,
      isPending: state.isPending,
      setMode: state.setMode,
      setActiveLocale: state.setActiveLocale,
      setDisabled: state.setDisabled,
      setIsPending: state.setIsPending,
      resetEditFields: state.resetEditFields,
    }))
  );
};
