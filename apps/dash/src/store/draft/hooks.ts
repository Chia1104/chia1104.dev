"use client";

import { useShallow } from "zustand/react/shallow";

import { useDraft as useDraftStore } from "./store";

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
