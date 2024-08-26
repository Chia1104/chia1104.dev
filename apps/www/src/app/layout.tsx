import type { ReactNode } from "react";

import { GoogleTagManager } from "@next/third-parties/google";
import "@total-typescript/ts-reset";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { ViewTransitions } from "next-view-transitions";
import "react-medium-image-zoom/dist/styles.css";

import meta from "@chia/meta";
import { ScrollYProgress } from "@chia/ui";
import { WWW_BASE_URL } from "@chia/utils";

import { env } from "@/env";

import "../styles/globals.css";
import Background from "./_components/background";
import Footer from "./_components/footer";
import NavMenu from "./_components/nav-menu";
import RootProvider from "./_components/root-provider";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FECACA" },
    { media: "(prefers-color-scheme: dark)", color: "#2B2E4A" },
  ],
  colorScheme: "dark",
  width: "device-width",
};

export const metadata: Metadata = {
  metadataBase: new URL(WWW_BASE_URL),
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
            <main>
              {children}
              {modal}
            </main>
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
