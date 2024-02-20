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
import { Page, ScrollYProgress } from "@chia/ui";
import NavMenu from "./_components/nav-menu";
import { GoogleTagManager } from "@next/third-parties/google";
import { env } from "@/env";

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
    <html lang="zh-Hant-TW" suppressHydrationWarning>
      <body className="c-bg-primary scrollbar-thin dark:scrollbar-thumb-dark scrollbar-thumb-light scrollbar-thumb-rounded-full">
        <RootProvider>
          <NavMenu />
          <ScrollYProgress className="fixed top-0 z-[999]" />
          <Page>
            {children}
            {modal}
          </Page>
          <Footer />
        </RootProvider>
        <VercelAnalytics />
        <GoogleTagManager gtmId={env.NEXT_PUBLIC_GTM_ID ?? ""} />
        <SpeedInsights />
      </body>
    </html>
  );
};

export default ChiaWEB;
