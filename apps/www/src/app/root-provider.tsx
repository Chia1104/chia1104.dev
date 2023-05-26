"use client";

import { type FC, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { useDarkMode, useIsMounted } from "@/hooks";
import { Toaster as ST } from "sonner";
import { AnimatePresence } from "framer-motion";

const Toaster: FC = () => {
  const { theme } = useDarkMode();
  const isMounted = useIsMounted();
  return (
    <ST theme={isMounted && (theme as any)} position="bottom-left" richColors />
  );
};

const RootProvider: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ThemeProvider enableSystem attribute="class">
      <Toaster />
      {children}
    </ThemeProvider>
  );
};

export default RootProvider;
