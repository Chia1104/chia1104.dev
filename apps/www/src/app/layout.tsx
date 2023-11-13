import "../styles/globals.css";
import { ErrorBoundary } from "@chia/ui";
import RootProvider from "./root-provider";
import { type ReactNode } from "react";
import { Chia } from "@/shared/meta/chia";
import "@total-typescript/ts-reset";
import type { Metadata, Viewport } from "next";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { getBaseUrl } from "@/utils/getBaseUrl";
import "react-medium-image-zoom/dist/styles.css";

export const viewport: Viewport = {
  themeColor: "#2B2E4A",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(
    getBaseUrl({
      isServer: true,
    })
  ),
  title: {
    default: `${Chia.name} | ${Chia.title}`,
    template: `%s | ${Chia.name}`,
  },
  description: Chia.content,
  keywords: [
    "Typescript",
    "FullStack",
    "NextJS",
    "React",
    "NestJS",
    "Chia1104",
  ],
  creator: Chia.name,
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  verification: {
    google: "google",
    yandex: "yandex",
    yahoo: "yahoo",
    other: {
      me: ["my-email", "my-link"],
    },
  },
};

const ChiaWEB = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="zh-Hant-TW" suppressHydrationWarning>
      <body className="c-bg-primary scrollbar-thin dark:scrollbar-thumb-dark scrollbar-thumb-light scrollbar-thumb-rounded-full">
        <ErrorBoundary>
          <RootProvider>{children}</RootProvider>
        </ErrorBoundary>
        <VercelAnalytics />
      </body>
    </html>
  );
};

export default ChiaWEB;
