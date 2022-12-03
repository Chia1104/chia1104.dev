import "../styles/globals.css";
import {
  ErrorBoundary,
  RootProvider,
  Analytics,
} from "@chia/components/client";
import { type ReactNode } from "react";

const ChiaWEB = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="zh-Hant-TW">
      <body className="c-bg-primary scrollbar-thin scrollbar-thumb-secondary scrollbar-thumb-rounded-full">
        <ErrorBoundary>
          <RootProvider>{children}</RootProvider>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  );
};

export default ChiaWEB;
