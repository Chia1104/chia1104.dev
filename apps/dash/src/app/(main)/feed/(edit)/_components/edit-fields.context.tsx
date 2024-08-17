"use client";

import { createContext, useContext } from "react";
import type { Dispatch, SetStateAction } from "react";

import { ArticleType } from "@chia/db/types";

export interface EditFieldsContext {
  disabled?: boolean;
  isPending?: boolean;
  content: {
    [ArticleType.Tiptap]: {
      content: string;
      source: string;
    };
    [ArticleType.Mdx]: {
      content: string;
      source: string;
    };
  };
  setContent: Dispatch<SetStateAction<EditFieldsContext["content"]>>;
  mode: "edit" | "create";
}

export const DEFAULT_EDIT_FIELDS_CONTEXT = {
  content: {
    [ArticleType.Mdx]: {
      content: "",
      source: "",
    },
    [ArticleType.Tiptap]: {
      content: "",
      source: "",
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setContent: () => {},
  mode: "create",
} satisfies EditFieldsContext;

export const EditFieldsContext = createContext<EditFieldsContext>(
  DEFAULT_EDIT_FIELDS_CONTEXT
);

export const useEditFieldsContext = () => {
  const ctx = useContext(EditFieldsContext);
  if (!ctx) {
    throw new Error(
      "useEditFieldsContext must be used within a EditFieldsProvider"
    );
  }
  return ctx;
};
