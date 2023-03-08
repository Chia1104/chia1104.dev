"use client";

import { type FC, type ReactNode } from "react";
import { Provider } from "react-redux";
import { store } from "@chia/store";
import { ThemeProvider } from "next-themes";
import { AnimatePresence } from "framer-motion";
import { useDarkMode, useIsMounted } from "@chia/hooks";
import { Toaster as ST } from "sonner";

const Toaster: FC = () => {
  const { theme } = useDarkMode();
  const isMounted = useIsMounted();
  return <ST theme={isMounted && (theme as any)} position="bottom-left" />;
};

const RootProvider: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ThemeProvider enableSystem={true} attribute="class">
      <Provider store={store}>
        <Toaster />
        <AnimatePresence mode="wait">{children}</AnimatePresence>
      </Provider>
    </ThemeProvider>
  );
};

export default RootProvider;
