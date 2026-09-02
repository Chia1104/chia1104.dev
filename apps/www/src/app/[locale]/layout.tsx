import "@total-typescript/ts-reset";
import "katex/dist/katex.css";
import "@/styles/globals.css";
import "react-medium-image-zoom/dist/styles.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";

import {
  getLocale,
  getMessages,
  getTimeZone,
  getTranslations,
} from "next-intl/server";

import meta from "@chia/meta";
import { WWW_BASE_URL } from "@chia/utils/config";

import { ChatDrawer } from "@/components/agent/chat-drawer";
import AppLayout from "@/components/commons/app-layout";
import AppPlugins from "@/components/commons/app-plugins";
import RootLayout from "@/components/commons/root-layout";
import RootProvider from "@/components/commons/root-provider";
import { routing } from "@/libs/i18n/routing";
import { initDayjs } from "@/libs/utils/dayjs";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FECACA" },
    { media: "(prefers-color-scheme: dark)", color: "#2B2E4A" },
  ],
  colorScheme: "dark",
  width: "device-width",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return {
    metadataBase: new URL(WWW_BASE_URL),
    title: {
      default: `${meta.name} | ${t("title")}`,
      template: `%s | ${meta.name}`,
    },
    description: t("bio"),
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
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const Layout = async ({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) => {
  const [locale, messages, timeZone] = await Promise.all([
    getLocale(),
    getMessages(),
    getTimeZone(),
  ]);
  initDayjs(locale, timeZone);

  return (
    <RootLayout locale={locale}>
      <RootProvider messages={messages} timeZone={timeZone} locale={locale}>
        <AppLayout locale={locale}>
          {children}
          {modal}
          {/* Reads `?chat`; static pages need the boundary to prerender. */}
          <Suspense>
            <ChatDrawer />
          </Suspense>
        </AppLayout>
        <AppPlugins />
      </RootProvider>
    </RootLayout>
  );
};

export default Layout;
