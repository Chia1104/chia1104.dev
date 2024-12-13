"use client";

import { createContext, use } from "react";

import type { ContentProps } from "./types";

/**
 * @deprecated remove context
 */
export const ContentContext = createContext<ContentProps>({} as ContentProps);

/**
 * @deprecated remove context
 */
export const useContent = () => {
  const context = use(ContentContext);
  if (!context) {
    throw new Error("useContent must be used within a ContentProvider");
  }
  return context;
};
