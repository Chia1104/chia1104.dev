import type { ReactNode } from "react";

import type { Metadata, Viewport } from "next";
import { getMessages, getTimeZone } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import meta from "@chia/meta";
import { WWW_BASE_URL } from "@chia/utils/config";

import AppLayout from "@/components/commons/app-layout";
import AppPlugins from "@/components/commons/app-plugins";
import Footer from "@/components/commons/footer";
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

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const Layout = async ({
  children,
  modal,
  params,
}: {
  children: ReactNode;
  modal: ReactNode;
  params: PageParamsWithLocale;
}) => {
  const locale = (await params).locale;
  if (!routing.locales.includes(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const timeZone = await getTimeZone();
  initDayjs(locale, timeZone);

  return (
    <RootLayout locale={locale}>
      <RootProvider messages={messages} timeZone={timeZone} locale={locale}>
        <AppLayout locale={locale}>
          {children}
          {modal}
        </AppLayout>
        <Footer locale={locale} />
        <AppPlugins />
      </RootProvider>
    </RootLayout>
  );
};

export default Layout;
