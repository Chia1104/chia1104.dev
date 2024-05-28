"use client";

import { useState, useContext, createContext } from "react";
import type { FC, Dispatch, ReactNode } from "react";

export interface State {
  title?: string;
  slug?: string;
  description?: string;
  feedType: "post" | "note";
  editorType: "novel" | "monaco";
  content?: string;
  sourceContent?: any;
  serializedContent?: any;
}

export interface Context {
  state: State | null;
  setState: Dispatch<State>;
}

export const WriteContext = createContext<Context>({
  state: {
    feedType: "note",
    editorType: "novel",
  },
  setState: () => undefined,
});

export const WriteProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<State>({
    feedType: "note",
    editorType: "novel",
  });
  return (
    <WriteContext.Provider value={{ state, setState }}>
      {children}
    </WriteContext.Provider>
  );
};

export const useWriteContext = () => {
  const context = useContext(WriteContext);
  if (!context) {
    throw new Error("useWriteContext must be used within a WriteProvider");
  }
  return context;
};
