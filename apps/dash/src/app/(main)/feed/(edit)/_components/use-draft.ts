"use client";

import { useMemo } from "react";

import { create } from "zustand";
import type { StateStorage, StorageValue } from "zustand/middleware";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CreateFeedInput } from "@chia/api/trpc/validators";

import type { EditFieldsContext } from "./edit-fields.context";
import { DEFAULT_EDIT_FIELDS_CONTEXT } from "./edit-fields.context";

export interface DraftState {
  draft: Partial<CreateFeedInput>;
  content: Partial<EditFieldsContext["content"]>;
  setDraft: (draft: Partial<CreateFeedInput>) => void;
  token: string;
}

export const storage: StateStorage = {
  getItem: (name) => {
    const value = localStorage.getItem(name);
    return value ? JSON.parse(value) : null;
  },
  setItem: (name, value) => {
    localStorage.setItem(name, JSON.stringify(value));
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
  },
};

export const useDraft = (token: string) =>
  create<DraftState>()(
    persist(
      (set) => ({
        draft: {},
        content: DEFAULT_EDIT_FIELDS_CONTEXT.content,
        setDraft: (draft) => set({ draft }),
        token,
      }),
      {
        name: `CONTENT_DRAFT_${token}`,
        storage: createJSONStorage(() => storage),
      }
    )
  );

export const useGetAllDrafts = () => {
  return useMemo(() => {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith("CONTENT_DRAFT_"))
      .map((key) => {
        const value = localStorage.getItem(key);
        return value
          ? (JSON.parse(
              JSON.parse(value) as string
            ) as StorageValue<DraftState>)
          : null;
      });
  }, []);
};
