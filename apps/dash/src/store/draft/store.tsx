"use client";

import { createContext, use, useRef } from "react";

import { create, useStore } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { EditFieldsState } from "./slices/edit-fields";
import { createEditFieldsSlice } from "./slices/edit-fields";

/** Editor UI state only; the draft itself lives on the server. */
export type DraftState = EditFieldsState;

export type DraftStore = ReturnType<typeof createDraftStore>;

export const DraftContext = createContext<DraftStore | undefined>(undefined);

const createDraftStore = (initialValues?: Partial<DraftState>) => {
  return create<DraftState>()(
    immer((...args) => ({
      ...createEditFieldsSlice(...args),
      ...initialValues,
    }))
  );
};

export const DraftProvider = ({
  children,
  initialValues,
}: {
  children: React.ReactNode;
  initialValues?: Partial<DraftState>;
}) => {
  const storeRef = useRef<DraftStore | undefined>(undefined);
  if (!storeRef.current) {
    storeRef.current = createDraftStore(initialValues);
  }
  return <DraftContext value={storeRef.current}>{children}</DraftContext>;
};

export const useDraft = <T,>(
  selector: (store: DraftState) => T,
  nameSpace = "useDraft"
): T => {
  const context = use(DraftContext);
  if (!context) {
    throw new Error(`${nameSpace} must be used within a DraftProvider`);
  }
  return useStore(context, selector);
};
