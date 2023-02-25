"use client";

import { type FC, type ReactNode } from "react";
import { Provider } from "react-redux";
import { store } from "@chia/store";
import { ThemeProvider } from "next-themes";
import { AnimatePresence } from "framer-motion";
import { ActionIcon, NavMenu } from "@chia/components/client";
import { useDarkMode } from "@chia/hooks";
import { Toaster as ST } from "sonner";

const Toaster: FC = () => {
  const { theme } = useDarkMode();
  return <ST theme={theme as any} position="bottom-left" />;
};

const RootProvider: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ThemeProvider enableSystem={true} attribute="class">
      <Provider store={store}>
        <Toaster />
        <NavMenu />
        <ActionIcon />
        <AnimatePresence mode="wait">{children}</AnimatePresence>
      </Provider>
    </ThemeProvider>
  );
};

export default RootProvider;
