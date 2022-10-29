import "../styles/globals.css";
import {
  ActionIcon,
  NavMenu,
  ErrorBoundary,
  ReduxProvider,
  NextThemeProvider,
  GeistProvider,
} from "@chia/components/client";
import { type ReactNode } from "react";
import { AnimatePresence } from "@chia/lib/framer-motion";

const ChiaWEB = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="zh-Hant-TW">
      <body className="c-bg-primary scrollbar-thin scrollbar-thumb-secondary scrollbar-thumb-rounded-full">
        <ErrorBoundary>
          <NextThemeProvider>
            <GeistProvider>
              <ReduxProvider>
                <NavMenu />
                <ActionIcon />
                <AnimatePresence mode="wait">{children}</AnimatePresence>
              </ReduxProvider>
            </GeistProvider>
          </NextThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
};

export default ChiaWEB;
