"use client";

import { createContext, useContext } from "react";

import type { ContentProps } from "./types";

export const ContentContext = createContext<ContentProps>({} as ContentProps);

export const useContent = () => {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error("useContent must be used within a ContentProvider");
  }
  return context;
};
