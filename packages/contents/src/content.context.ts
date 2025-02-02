"use client";

import { createContext, use } from "react";

import type { ContentContextProps } from "./types";

export const ContentContext = createContext<ContentContextProps | undefined>(
  undefined
);

export const useContent = () => {
  const context = use(ContentContext);
  if (!context) {
    throw new Error("useContent must be used within a ContentProvider");
  }
  return context;
};
