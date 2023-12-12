import { createContext, useContext, type ReactNode } from "react";

export const NovelNextContext = createContext<NovelNextProps>({
  completionApi: "/api/ai/generate",
});

export function useNovelNextContext() {
  const ctx = useContext(NovelNextContext);
  if (!ctx) {
    throw new Error(
      "`useNovelNextContext` must be used within a `NovelNextProvider`"
    );
  }
  return ctx;
}

export const NovelNextProvider = ({
  children,
  ...props
}: NovelNextProps & { children: ReactNode }) => {
  return (
    <NovelNextContext.Provider value={props}>
      {children}
    </NovelNextContext.Provider>
  );
};
