"use client";

import { useCallback } from "react";

import { useShallow } from "zustand/react/shallow";

import type { feedsContracts } from "@chia/api/orpc/contracts";

import { useDraftStore } from "./store";
import type { DraftData, EditFieldsContext } from "./store";

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
      content: state.content,
    }))
  );

  const draft = store.draftsMap[token];

  const saveDraft = useCallback(
    (
      formData: Partial<feedsContracts.CreateFeedInput>,
      content?: EditFieldsContext["content"]
    ) => {
      store.saveDraft(token, formData, content);
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
    (data: {
      draft?: Partial<feedsContracts.CreateFeedInput>;
      content?: EditFieldsContext["content"];
    }) => {
      if (data.draft) {
        store.saveDraft(token, data.draft, data.content);
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
      content: state.content,
      mode: state.mode,
      disabled: state.disabled,
      isPending: state.isPending,
      updateContent: state.updateContent,
      setContent: state.setContent,
      setMode: state.setMode,
      setDisabled: state.setDisabled,
      setIsPending: state.setIsPending,
      resetEditFields: state.resetEditFields,
      getContent: state.getContent,
    }))
  );
};

/**
 * useEditFieldsContext Hook
 * 兼容舊的 Context API
 *
 * @param token - 可選的 token（用於向後兼容）
 * @returns EditFieldsContext
 *
 * @deprecated 建議使用 useEditFields
 */
export const useEditFieldsContext = (token?: string): EditFieldsContext => {
  const state = useDraftStore(
    useShallow((state) => ({
      content: state.content,
      mode: state.mode,
      disabled: state.disabled,
      isPending: state.isPending,
      setContent: state.setContent,
    }))
  );

  return {
    content: state.content,
    mode: state.mode,
    token,
    disabled: state.disabled,
    isPending: state.isPending,
    setContent: state.setContent,
  };
};
