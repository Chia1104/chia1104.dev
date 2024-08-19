"use client";

import { createContext, useContext } from "react";
import type { Dispatch, SetStateAction } from "react";

import { ContentType } from "@chia/db/types";

export interface EditFieldsContext {
  disabled?: boolean;
  isPending?: boolean;
  content: {
    [ContentType.Tiptap]: {
      content: string;
      source: string;
    };
    [ContentType.Mdx]: {
      content: string;
      source: string;
    };
    [ContentType.Plate]: {
      content: string;
      source: string;
    };
  };
  setContent: Dispatch<SetStateAction<EditFieldsContext["content"]>>;
  mode: "edit" | "create";
  token: string;
}

export const DEFAULT_EDIT_FIELDS_CONTEXT = {
  content: {
    [ContentType.Mdx]: {
      content: "",
      source: "",
    },
    [ContentType.Tiptap]: {
      content: "",
      source: "",
    },
    [ContentType.Plate]: {
      content: "",
      source: "",
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setContent: () => {},
  mode: "create",
  token: "",
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
