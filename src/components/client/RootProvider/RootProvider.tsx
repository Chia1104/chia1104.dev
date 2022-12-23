"use client";

import { type FC, type ReactNode } from "react";
import { Provider } from "react-redux";
import { store } from "@chia/store";
import { ThemeProvider } from "next-themes";
import { GeistProvider as GP } from "@geist-ui/core";
import { AnimatePresence } from "framer-motion";
import { ActionIcon, NavMenu } from "@chia/components/client";
import { useDarkMode, useIsMounted } from "@chia/hooks";

const GeistProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { isDarkMode } = useDarkMode();
  const isMounted = useIsMounted();

  return (
    <GP themeType={isMounted && isDarkMode ? "dark" : "light"}>{children}</GP>
  );
};

const RootProvider: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ThemeProvider enableSystem={true} attribute="class">
      <GeistProvider>
        <Provider store={store}>
          <NavMenu />
          <ActionIcon />
          <AnimatePresence mode="wait">{children}</AnimatePresence>
          <div id="__modal_root" />
        </Provider>
      </GeistProvider>
    </ThemeProvider>
  );
};

export default RootProvider;
