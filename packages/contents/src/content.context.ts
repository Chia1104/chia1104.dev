"use client";

import { createContext, use } from "react";

import type { ContentProps } from "./types";

export const ContentContext = createContext<ContentProps>({} as ContentProps);

export const useContent = () => {
  const context = use(ContentContext);
  if (!context) {
    throw new Error("useContent must be used within a ContentProvider");
  }
  return context;
};
