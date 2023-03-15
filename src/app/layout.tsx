import "../styles/globals.css";
import { ErrorBoundary } from "@chia/ui";
import { RootProvider, Analytics } from "@chia/app/components";
import { type ReactNode } from "react";
import { Chia } from "@chia/shared/meta/chia";
import "@total-typescript/ts-reset";
import type { Metadata } from "next";
import { getBaseUrl } from "@chia/utils/getBaseUrl";

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
  openGraph: {
    type: "website",
    locale: "zh_TW",
    url: "https://chia1104.dev",
    siteName: Chia.name,
    title: Chia.name,
    description: Chia.content,
    images: [
      {
        url: `${getBaseUrl({ isServer: true })}/api/og`,
        width: 1200,
        height: 630,
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  twitter: {
    card: "summary_large_image",
    title: Chia.name,
    description: Chia.content,
    creator: `@${Chia.name.toLowerCase()}`,
    images: [`${getBaseUrl({ isServer: true })}/api/og`],
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
        <Analytics />
      </body>
    </html>
  );
};

export default ChiaWEB;
