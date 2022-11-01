import "../styles/globals.css";
import {
  ActionIcon,
  NavMenu,
  ErrorBoundary,
  ReduxProvider,
  GeistProvider,
} from "@chia/components/client";
import { type ReactNode } from "react";
import { AnimatePresence } from "@chia/lib/framer-motion";
import { ThemeProvider } from "@chia/lib/next-themes";

const ChiaWEB = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="zh-Hant-TW">
      <body className="c-bg-primary scrollbar-thin scrollbar-thumb-secondary scrollbar-thumb-rounded-full">
        <ErrorBoundary>
          <ThemeProvider enableSystem={true} attribute="class">
            <GeistProvider>
              <ReduxProvider>
                <NavMenu />
                <ActionIcon />
                <AnimatePresence mode="wait">{children}</AnimatePresence>
              </ReduxProvider>
            </GeistProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
};

export const runtime = "nodejs";

export default ChiaWEB;
