import "../styles/globals.css";
import RootProvider from "./_components/root-provider";
import { type ReactNode } from "react";
import meta from "@chia/meta";
import "@total-typescript/ts-reset";
import type { Metadata, Viewport } from "next";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { getBaseUrl, WWW_BASE_URL } from "@chia/utils";
import "react-medium-image-zoom/dist/styles.css";
import Footer from "./_components/footer";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ScrollYProgress } from "@chia/ui";
import NavMenu from "./_components/nav-menu";
import { GoogleTagManager } from "@next/third-parties/google";
import Background from "./_components/background";
import { env } from "@/env";
import { ViewTransitions } from "next-view-transitions";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FECACA" },
    { media: "(prefers-color-scheme: dark)", color: "#2B2E4A" },
  ],
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(
    getBaseUrl({
      isServer: true,
      baseUrl: WWW_BASE_URL,
    })
  ),
  title: {
    default: `${meta.name} | ${meta.title}`,
    template: `%s | ${meta.name}`,
  },
  description: meta.content,
  keywords: [
    "Typescript",
    "FullStack",
    "NextJS",
    "React",
    "NestJS",
    "Chia1104",
  ],
  creator: meta.name,
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

const ChiaWEB = ({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) => {
  return (
    <ViewTransitions>
      <html lang="zh-Hant-TW" suppressHydrationWarning>
        <body className="scrollbar-thin dark:scrollbar-thumb-dark scrollbar-thumb-light scrollbar-thumb-rounded-full">
          <RootProvider>
            <Background />
            <NavMenu />
            <ScrollYProgress className="fixed top-0 z-[999]" />
            {children}
            {modal}
            <Footer />
          </RootProvider>
          <VercelAnalytics />
          <GoogleTagManager gtmId={env.NEXT_PUBLIC_GTM_ID ?? ""} />
          <SpeedInsights />
        </body>
      </html>
    </ViewTransitions>
  );
};

export default ChiaWEB;
