import "../styles/globals.css";
import RootProvider from "./_components/root-provider";
import { type ReactNode } from "react";
import meta from "@chia/meta";
import "@total-typescript/ts-reset";
import type { Metadata, Viewport } from "next";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { getBaseUrl } from "@/utils/getBaseUrl";
import "react-medium-image-zoom/dist/styles.css";
import Footer from "./_components/footer";

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

const ChiaWEB = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="zh-Hant-TW" suppressHydrationWarning>
      <body className="c-bg-primary scrollbar-thin dark:scrollbar-thumb-dark scrollbar-thumb-light scrollbar-thumb-rounded-full">
        <RootProvider>
          {children}
          <Footer />
        </RootProvider>
        <VercelAnalytics />
      </body>
    </html>
  );
};

export default ChiaWEB;
