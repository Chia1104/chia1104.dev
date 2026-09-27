"use client";

import "@/styles/globals.css";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import { ThemeProvider } from "next-themes";

import { Theme } from "@chia/ui/utils/use-theme";

import type ErrorPage from "@/components/commons/error-page";
import RootLayout from "@/components/commons/root-layout";
import { routing } from "@/libs/i18n/routing";

/** Next ships this file with every page, so the message catalog loads only once an error renders. */
const GlobalErrorContent = dynamic(
  () => import("@/components/commons/global-error-content")
);

/**
 * Replaces the document when the root layout itself fails, so it rebuilds only what the error page
 * needs: the theme, the default locale's messages and the railed column.
 */
const GlobalError = (props: ComponentProps<typeof ErrorPage>) => (
  <RootLayout locale={routing.defaultLocale}>
    <ThemeProvider defaultTheme={Theme.System} enableSystem attribute="class">
      <div className="@container/page isolate flex min-h-dvh flex-col">
        <main className="flex flex-1 flex-col overflow-x-clip px-2">
          <div className="border-separator mx-auto flex w-full max-w-3xl flex-1 flex-col border-x py-12">
            <GlobalErrorContent {...props} />
          </div>
        </main>
      </div>
    </ThemeProvider>
  </RootLayout>
);

export default GlobalError;
