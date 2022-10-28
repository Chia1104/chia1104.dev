import "../styles/globals.css";
import {
  ActionIcon,
  NavMenu,
  ErrorBoundary,
  AnimatePresence,
  ReduxProvider,
  NextThemeProvider,
} from "@chia/components/client";
import { type ReactNode } from "react";

const ChiaWEB = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="zh-Hant-TW">
      <body className="c-bg-primary scrollbar-thin scrollbar-thumb-secondary scrollbar-thumb-rounded-full">
        <ErrorBoundary>
          <NextThemeProvider>
            <ReduxProvider>
              <NavMenu />
              <ActionIcon />
              <AnimatePresence mode="wait">{children}</AnimatePresence>
            </ReduxProvider>
          </NextThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
};

export default ChiaWEB;
