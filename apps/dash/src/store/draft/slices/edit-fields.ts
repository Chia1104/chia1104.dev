"use client";

import * as z from "zod";
import type { StateCreator } from "zustand";

import { feedsContracts } from "@chia/api/orpc/contracts";
import { Locale } from "@chia/db/types";

import type { DraftState } from "../store";

/** The editable half of a draft plus which locale the form is showing. */
export const formSchema = z.compile(
  feedsContracts.feedDraftSchema
    .pick({
      slug: true,
      type: true,
      defaultLocale: true,
      mainImage: true,
      translations: true,
    })
    .extend({ activeLocale: z.enum(Locale) })
);

export type FormSchema = z.infer<typeof formSchema>;

export interface EditFieldsContext {
  disabled?: boolean;
  isPending?: boolean;
  /** `edit` once the draft is bound to a feed: the slug is fixed and feed actions show. */
  mode: "edit" | "create";
  activeLocale: Locale;
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
  [["zustand/immer", never]],
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
