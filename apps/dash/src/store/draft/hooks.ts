"use client";

import { useCallback } from "react";

import { useShallow } from "zustand/react/shallow";

import type { feedsContracts } from "@chia/api/orpc/contracts";

import { useDraft as useDraftStore } from "./store";
import type { DraftData } from "./store";

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
    draft,
    createDraft,
    saveDraft,
    deleteDraft,
    getState,
    setState,
  };
};

export const useAllDrafts = (): DraftData[] => {
  const draftsMap = useDraftStore(useShallow((state) => state.draftsMap));

  return Object.values(draftsMap);
};

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
