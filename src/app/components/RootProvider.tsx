"use client";

import { type FC, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { AnimatePresence } from "framer-motion";
import { useDarkMode, useIsMounted } from "@chia/hooks";
import { Toaster as ST } from "sonner";

const Toaster: FC = () => {
  const { theme } = useDarkMode();
  const isMounted = useIsMounted();
  return (
    <ST theme={isMounted && (theme as any)} position="bottom-left" richColors />
  );
};

const RootProvider: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ThemeProvider enableSystem={true} attribute="class">
      <Toaster />
      <AnimatePresence mode="wait">{children}</AnimatePresence>
    </ThemeProvider>
  );
};

export default RootProvider;
