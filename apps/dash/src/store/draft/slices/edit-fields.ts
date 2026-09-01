"use client";

import * as z from "zod";
import type { StateCreator } from "zustand";

import { feedsContracts } from "@chia/api/orpc/contracts";
import { Locale } from "@chia/db/types";

import type { DraftState } from "../store";

export type FormSchema = feedsContracts.CreateFeedInput & {
  activeLocale: Locale;
};

export const formSchema = z.compile(
  feedsContracts.createFeedSchema.extend({
    activeLocale: z.enum(Locale),
  })
);

export interface ContentData {
  content: string;
  source: string;
}

export interface EditFieldsContext {
  disabled?: boolean;
  isPending?: boolean;
  mode: "edit" | "create";
  activeLocale: Locale;
  token?: string;
}

export interface EditFieldsState {
  mode: EditFieldsContext["mode"];
  activeLocale: Locale;
  disabled: boolean;
  isPending: boolean;
  setMode: (mode: EditFieldsContext["mode"]) => void;
  setActiveLocale: (locale: Locale) => void;
  setDisabled: (disabled: boolean) => void;
  setIsPending: (isPending: boolean) => void;
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
