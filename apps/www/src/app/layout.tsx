import "../styles/globals.css";
import { ErrorBoundary } from "ui";
import RootProvider from "./root-provider";
import { type ReactNode } from "react";
import { Chia } from "@/shared/meta/chia";
import "@total-typescript/ts-reset";
import type { Metadata } from "next";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
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
  themeColor: "#2B2E4A",
  colorScheme: "dark",
  creator: Chia.name,
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
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
    <html lang="zh-Hant-TW">
      <body className="c-bg-primary scrollbar-thin scrollbar-thumb-secondary scrollbar-thumb-rounded-full">
        <ErrorBoundary>
          <RootProvider>{children}</RootProvider>
        </ErrorBoundary>
        <VercelAnalytics />
      </body>
    </html>
  );
};

export default ChiaWEB;
